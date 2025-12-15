import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SpeechRecognitionService } from '../services/speech-recognition.service';
import { TranslationService, Language } from '../services/translation.service';
import { TextToSpeechService } from '../services/text-to-speech.service';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-translator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './translator.html',
  styleUrl: './translator.css'
})
export class TranslatorComponent implements OnInit, OnDestroy {
  originalText = signal<string>('');
  translatedText = signal<string>('');
  isListening = signal<boolean>(false);
  isTranslating = signal<boolean>(false);
  selectedLanguage = signal<string>(''); // Default to empty
  errorMessage = signal<string>('');
  isSpeaking = signal<boolean>(false);
  timeRemaining = signal<number>(120); // Countdown timer in seconds
  enableTextToSpeech = signal<boolean>(false); // Default to disabled
  showInfoModal = signal<boolean>(false); // Info modal visibility
  currentUrl = signal<string>('');

  @ViewChild('originalBox') private originalBox?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('translatedBox') private translatedBox?: ElementRef<HTMLTextAreaElement>;

  private subscriptions = new Subscription();
  private lastTranslatedText = '';
  private textChangeSubject = new Subject<string>();
  private countdownInterval: any = null;
  private scrollScheduleTimer: any = null;
  private pendingTranslations = 0;
  private nextSegmentId = 1;

  private segments = signal<Array<{ id: number; original: string; translated: string; translating: boolean }>>([]);
  private interimOriginal = signal<string>('');
  private interimTranslated = signal<string>('');
  private manualMode = signal<boolean>(false);

  // Speech-mode translation batching (to reduce API usage):
  // - Only translate completed sentences (ending in . ! ? etc), OR
  // - Translate whatever we have after a short pause in speaking.
  private speechBuffer = '';
  private speechPauseTimer: any = null;
  private readonly speechPauseMs = 1300;

  // Languages for dropdown - initialize in ngOnInit
  languages: Language[] = [];

  // Computed: show detected language or selected language
  displayLanguage = computed(() => {
    const lang = this.translationService.getLanguageByCode(this.selectedLanguage());
    return lang ? lang.name : 'Select Language';
  });

  constructor(
    protected speechRecognition: SpeechRecognitionService,
    private translationService: TranslationService,
    private textToSpeech: TextToSpeechService,
    private storageService: StorageService
  ) { }

  // ...

  ngOnInit(): void {
    // Expose the current URL in the UI (helpful when the browser chrome hides it).
    try {
      this.currentUrl.set(typeof window !== 'undefined' ? window.location.href : '');
    } catch {
      this.currentUrl.set('');
    }
    // Initialize languages
    this.languages = this.translationService.languages;

    // Load user preferences from local storage
    const preferences = this.storageService.getPreferences();
    console.log('[Translator] Full preferences from storage:', preferences);

    const savedLanguage = preferences.selectedLanguage;
    if (savedLanguage) {
      this.selectedLanguage.set(savedLanguage);
      console.log('[Translator] Applied saved language:', savedLanguage);
      // Auto-start listening if we have a saved language
      this.autoStartListening();
    } else {
      // Default to empty (require selection)
      this.selectedLanguage.set('');
      console.log('[Translator] No valid saved language, requiring selection');
    }

    // Load TTS preference (default to false)
    const enableTTS = preferences.enableTextToSpeech ?? false;
    this.enableTextToSpeech.set(enableTTS);
    console.log('[Translator] TTS enabled:', enableTTS);

    // Subscribe to debounced text changes for translation
    this.subscriptions.add(
      this.textChangeSubject.pipe(
        debounceTime(900), // Less chatty (esp. for MyMemory free tier)
        distinctUntilChanged() // Only translate if text actually changed
      ).subscribe((text: string) => {
        // Debounced translation for interim speech results (and manual typing)
        this.translateInterim(text);
      })
    );

    // Subscribe to speech recognition transcript
    this.subscriptions.add(
      this.speechRecognition.transcript$.subscribe(result => {
        console.log('[Translator] Received transcript:', result);
        // Speech input switches us out of manual typing mode
        if (this.manualMode()) {
          this.manualMode.set(false);
          this.segments.set([]);
          this.interimOriginal.set('');
          this.interimTranslated.set('');
          this.speechBuffer = '';
          this.clearSpeechPauseTimer();
        }

        // Reset the *UI* 120s timer whenever we detect speech
        this.resetCountdownToFull();

        // Any transcript activity means "not a break" yet.
        this.resetSpeechPauseTimer();

        if (result.isFinal) {
          const finalText = (result.text || '').trim();
          if (!finalText) return;

          // Add final text into our buffer. We'll only translate completed sentences,
          // and flush the rest when there's a pause in speaking.
          this.speechBuffer = this.joinWithSpace(this.speechBuffer, finalText);
          this.flushSpeechBuffer({ force: false });
        } else {
          // Interim result (not committed). Show buffer + interim at the bottom.
          const interim = (result.text || '').trim();
          this.interimOriginal.set(this.joinWithSpace(this.speechBuffer, interim));
          // Do NOT translate interim speech results anymore (too chatty for free tiers).
          // We only translate finalized chunks.
          this.interimTranslated.set('');
          this.rebuildDisplayStrings();
        }
      })
    );

    // Subscribe to listening state
    this.subscriptions.add(
      this.speechRecognition.isListening$.subscribe(listening => {
        const wasListening = this.isListening();
        this.isListening.set(listening);

        // Only start countdown on initial start, not on auto-restarts
        if (listening && !wasListening) {
          console.log('[Translator] Starting countdown timer (initial start)');
          this.startCountdownTimer();
        } else if (!listening && wasListening) {
          console.log('[Translator] Stopping countdown timer');
          // Treat "stop listening" as a break in talking: flush any buffered text.
          this.clearSpeechPauseTimer();
          this.flushSpeechBuffer({ force: true });
          this.stopCountdownTimer();
        }
      })
    );

    // Subscribe to errors
    this.subscriptions.add(
      this.speechRecognition.error$.subscribe(error => {
        this.handleError(error);
      })
    );

    // Check if speech recognition is supported
    if (!this.speechRecognition.isSupported()) {
      this.errorMessage.set('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }

    // Keep the newest translation visible (and avoid fighting typing).
    effect(() => {
      // Depend on these signals
      this.originalText();
      this.translatedText();
      // Schedule after DOM updates/layout so scroll isn't lost.
      this.scheduleAutoScrollToLatest();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.speechRecognition.stopListening();
    this.textToSpeech.stop();
    this.stopCountdownTimer();
    this.clearSpeechPauseTimer();
    this.clearScrollScheduleTimer();
  }

  private async autoStartListening(): Promise<void> {
    // Wait a brief moment for the UI to settle, then auto-start listening
    setTimeout(async () => {
      if (this.selectedLanguage() && !this.isListening()) {
        const langCode = this.getSpeechLanguageCode();
        console.log('[Translator] Auto-starting listening with language code:', langCode);
        await this.speechRecognition.startListening(langCode);
      }
    }, 500);
  }

  async toggleListening(): Promise<void> {
    if (!this.selectedLanguage()) {
      this.errorMessage.set('Please select a source language first.');
      return;
    }

    if (this.isListening()) {
      this.speechRecognition.stopListening();
    } else {
      // Get the language code for speech recognition
      const langCode = this.getSpeechLanguageCode();
      this.errorMessage.set('');
      await this.speechRecognition.startListening(langCode);
    }
  }

  private getSpeechLanguageCode(): string {
    const selected = this.selectedLanguage();
    console.log('[Translator] getSpeechLanguageCode - selected language code:', selected);
    if (!selected) {
      console.log('[Translator] No language selected, defaulting to en-US');
      return 'en-US';
    }
    const webSpeechCode = this.translationService.toWebSpeechCode(selected);
    console.log('[Translator] Mapped', selected, 'to Web Speech code:', webSpeechCode);
    return webSpeechCode;
  }

  onLanguageChange(languageCode: string): void {
    this.selectedLanguage.set(languageCode);

    // Save preference to local storage
    const preferences = this.storageService.getPreferences();
    preferences.selectedLanguage = languageCode;
    this.storageService.savePreferences(preferences);
    console.log('[Translator] Saved language preference:', languageCode);

    // Auto-start listening when language is selected
    if (languageCode && !this.isListening()) {
      this.autoStartListening();
    }

    // If the user is manually typing, re-translate their current text.
    // For speech-history mode, new segments will be translated as they arrive.
    if (this.manualMode()) {
      const currentText = this.originalText();
      if (currentText && currentText.trim()) {
        this.textChangeSubject.next(this.truncateForQuery(currentText, 450));
      }
    }
  }

  onTextChange(text: string): void {
    // This method is called when user manually types in the textarea
    // Use the same logic as speech input
    this.manualMode.set(true);
    this.segments.set([]);
    this.interimOriginal.set('');
    this.interimTranslated.set('');
    this.originalText.set(text);

    if (!text || text.trim().length === 0) {
      this.translatedText.set('');
      return;
    }

    // Queue for debounced translation
    this.textChangeSubject.next(this.truncateForQuery(text, 450));
  }

  private translateTextOnce(text: string, sourceLanguage?: string): void {
    console.log('Translating text:', text, 'from language:', sourceLanguage || 'auto');
    this.pendingTranslations += 1;
    this.isTranslating.set(true);
    this.translationService.translate(text, 'en', sourceLanguage).subscribe({
      next: (result) => {
        // If the service returned an error (service-level fallback), don't echo the source text
        // into the English box — instead show a helpful error and keep translation empty.
        if (result?.error) {
          console.warn('[Translator] Translation service returned error result:', result.error);
          this.pendingTranslations = Math.max(0, this.pendingTranslations - 1);
          this.isTranslating.set(this.pendingTranslations > 0);
          this.errorMessage.set(`⚠️ Translation unavailable: ${result.error}`);
          this.translatedText.set('');
          return;
        }

        this.translatedText.set(result.translatedText);
        this.pendingTranslations = Math.max(0, this.pendingTranslations - 1);
        this.isTranslating.set(this.pendingTranslations > 0);

        // Auto-speak the translation if enabled and different from last one
        // Only speak if TTS is enabled and not already speaking
        // Wrap in try-catch so TTS errors don't break translation
        if (this.enableTextToSpeech() && result.translatedText && result.translatedText !== this.lastTranslatedText && !this.isSpeaking()) {
          this.lastTranslatedText = result.translatedText;
          try {
            this.speakTranslation(result.translatedText);
          } catch (error) {
            console.log('[Translator] TTS failed, but translation succeeded');
          }
        }

        // Save to history
        this.storageService.addToHistory({
          original: text,
          translated: result.translatedText,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          timestamp: new Date().toISOString()
        });
      },
      error: (error) => {
        console.error('Error translating:', error);
        this.pendingTranslations = Math.max(0, this.pendingTranslations - 1);
        this.isTranslating.set(this.pendingTranslations > 0);

        // Provide more specific error messages
        const status = error?.status || 0;
        const errorMsg = error?.error?.error || error?.message || 'Unknown error';

        if (status === 0) {
          // CORS or network error
          this.errorMessage.set('⚠️ CORS/Network Error: Firebase Functions may not be deployed or CORS is not configured. Status 0 means the browser blocked the request. Please deploy Firebase Functions: firebase deploy --only functions');
        } else if (status === 404 || errorMsg.includes('404') || errorMsg.includes('not found')) {
          this.errorMessage.set('⚠️ Function Not Found (404): Firebase Functions are not deployed. Deploy using: firebase deploy --only functions');
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
          this.errorMessage.set('⚠️ Network Error: Cannot reach translation service. Check internet connection and Firebase Functions deployment.');
        } else if (errorMsg.includes('CORS')) {
          this.errorMessage.set('⚠️ CORS Error: Firebase Functions CORS configuration issue. Ensure functions are deployed with proper CORS headers.');
        } else {
          this.errorMessage.set(`⚠️ Translation failed: ${errorMsg}. Ensure Firebase Functions are deployed and Translation API is enabled.`);
        }
      }
    });
  }

  private translateInterim(text: string): void {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      this.interimTranslated.set('');
      this.rebuildDisplayStrings();
      return;
    }

    // Only translate interim text in MANUAL typing mode.
    // Speech mode only translates finalized chunks (less chatty / fewer API calls).
    if (this.manualMode()) {
      const sourceLang = this.selectedLanguage();
      if (!sourceLang) {
        this.errorMessage.set('Please select a source language');
        return;
      }
      this.errorMessage.set('');
      this.translateTextOnce(this.truncateForQuery(trimmed, 450), sourceLang);
      return;
    }
  }

  speakTranslation(text: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }

    // Don't interrupt if already speaking the same text
    if (this.isSpeaking() && this.lastTranslatedText === text) {
      return;
    }

    // Try to speak, but don't let TTS errors disrupt translation
    try {
      this.isSpeaking.set(true);
      this.textToSpeech.speak(text, 'en-US');

      // Update speaking state based on text-to-speech service
      // We'll use a timeout as a fallback, but also check periodically
      const estimatedDuration = Math.max(text.length * 80, 1000); // At least 1 second
      setTimeout(() => {
        // Only clear if still marked as speaking (might have been cleared by service)
        if (this.isSpeaking()) {
          this.isSpeaking.set(false);
        }
      }, estimatedDuration);
    } catch (error) {
      console.log('[Translator] TTS error caught, continuing anyway:', error);
      this.isSpeaking.set(false);
    }
  }

  stopSpeaking(): void {
    this.textToSpeech.stop();
    this.isSpeaking.set(false);
  }

  handleError(error: string): void {
    let message = '';
    switch (error) {
      case 'no-speech':
        // Don't show an error message or stop listening - this is normal during pauses
        console.log('No speech detected, but continuing to listen...');
        return;
      case 'audio-capture':
        message = 'Microphone not found or access denied. Please check your microphone settings.';
        break;
      case 'not-allowed':
        message = 'Microphone permission denied. If you\'re using Cursor\'s embedded browser, microphone access may be blocked—open this site in Chrome/Edge. Otherwise, click the lock icon in your browser\'s address bar and allow microphone access, then reload.';
        break;
      case 'network':
        message = 'Network error. Please check your connection.';
        break;
      case 'timeout':
        message = '⏱️ Listening timeout reached (120 seconds). Click "Start Listening" to resume.';
        break;
      case 'aborted':
        // User stopped, not really an error
        return;
      default:
        // For other errors, just log them but don't stop listening
        console.warn('Speech recognition warning:', error);
        return;
    }
    this.errorMessage.set(message);
    this.isListening.set(false);
  }

  async copyCurrentUrl(): Promise<void> {
    const url = this.currentUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.errorMessage.set('Link copied.');
      setTimeout(() => {
        // Don't clear a real error
        if (this.errorMessage() === 'Link copied.') this.errorMessage.set('');
      }, 1200);
    } catch {
      // Fallback for environments without clipboard permissions
      try {
        // eslint-disable-next-line no-alert
        window.prompt('Copy this link:', url);
      } catch {
        // ignore
      }
    }
  }

  onTextToSpeechChange(enabled: boolean): void {
    this.enableTextToSpeech.set(enabled);

    // Save preference to local storage
    const preferences = this.storageService.getPreferences();
    preferences.enableTextToSpeech = enabled;
    this.storageService.savePreferences(preferences);
    console.log('[Translator] Saved TTS preference:', enabled);

    // If disabling, stop any current speech
    if (!enabled && this.isSpeaking()) {
      this.stopSpeaking();
    }
  }

  openInfoModal(): void {
    this.showInfoModal.set(true);
  }

  closeInfoModal(): void {
    this.showInfoModal.set(false);
  }

  clearText(): void {
    this.originalText.set('');
    this.translatedText.set('');
    this.errorMessage.set('');
    this.lastTranslatedText = '';
    this.segments.set([]);
    this.interimOriginal.set('');
    this.interimTranslated.set('');
    this.manualMode.set(false);
    this.speechBuffer = '';
    this.clearSpeechPauseTimer();
  }

  private resetSpeechPauseTimer(): void {
    this.clearSpeechPauseTimer();
    this.speechPauseTimer = setTimeout(() => {
      // A pause/break in talking: translate whatever remains in the buffer.
      this.flushSpeechBuffer({ force: true });
    }, this.speechPauseMs);
  }

  private clearSpeechPauseTimer(): void {
    if (this.speechPauseTimer) {
      clearTimeout(this.speechPauseTimer);
      this.speechPauseTimer = null;
    }
  }

  private flushSpeechBuffer(opts: { force: boolean }): void {
    const input = (this.speechBuffer || '').trim();
    if (!input) {
      this.interimOriginal.set('');
      this.interimTranslated.set('');
      this.rebuildDisplayStrings();
      return;
    }

    const extracted = this.extractCompletedSentences(input);
    const completed = extracted.completed;
    const remainder = (extracted.remainder || '').trim();

    // If forced (pause), treat remainder as a chunk to translate too.
    const toTranslate = opts.force ? [...completed, ...(remainder ? [remainder] : [])] : completed;

    if (toTranslate.length > 0) {
      // Pack sentences into <=450 char chunks to reduce API calls.
      const pieces = this.packIntoChunks(toTranslate, 450);
      for (const piece of pieces) {
        this.appendSegment(piece);
      }
    }

    // Keep only the unfinished tail (unless we forced a flush).
    this.speechBuffer = opts.force ? '' : remainder;

    // Show whatever is left as interim (untranslated).
    this.interimOriginal.set(this.speechBuffer);
    this.interimTranslated.set('');
    this.rebuildDisplayStrings();
  }

  private extractCompletedSentences(text: string): { completed: string[]; remainder: string } {
    const cleaned = (text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return { completed: [], remainder: '' };

    const completed: string[] = [];
    let current = '';

    for (const ch of cleaned) {
      current += ch;
      if (this.isSentenceTerminator(ch)) {
        const s = current.trim();
        if (s) completed.push(s);
        current = '';
      }
    }

    return { completed, remainder: current.trim() };
  }

  private isSentenceTerminator(ch: string): boolean {
    return ch === '.' || ch === '!' || ch === '?' || ch === '。' || ch === '！' || ch === '？';
  }

  private joinWithSpace(a: string, b: string): string {
    const left = (a || '').trim();
    const right = (b || '').trim();
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
  }

  private resetCountdownToFull(): void {
    // If we’re currently listening, treat the timer as "seconds since last speech"
    if (this.isListening()) {
      this.timeRemaining.set(120);
    }
  }

  private startCountdownTimer(): void {
    // Don't restart timer if already running
    if (this.countdownInterval) {
      console.log('[Translator] Timer already running, not restarting');
      return;
    }

    // Reset to 120 seconds
    this.timeRemaining.set(120);
    console.log('[Translator] Started countdown timer from 120 seconds');

    // Update every second
    this.countdownInterval = setInterval(() => {
      const current = this.timeRemaining();
      if (current > 0) {
        this.timeRemaining.set(current - 1);
      } else {
        // Timer reached 0, stop the interval
        console.log('[Translator] Timer reached 0');
        this.stopCountdownTimer();
      }
    }, 1000);
  }

  private stopCountdownTimer(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.timeRemaining.set(120); // Reset to 120
  }

  // Format time as MM:SS
  get formattedTime(): string {
    const time = this.timeRemaining();
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private appendSegment(original: string): void {
    const sourceLang = this.selectedLanguage();
    const safeOriginal = this.truncateForQuery(original, 450);
    const id = this.nextSegmentId++;

    // Append placeholder segment
    const next = [...this.segments(), { id, original: safeOriginal, translated: '', translating: true }];
    this.segments.set(next);

    if (!sourceLang) {
      this.updateSegment(id, { translated: '', translating: false });
      this.rebuildDisplayStrings();
      return;
    }

    this.pendingTranslations += 1;
    this.isTranslating.set(true);
    this.translationService.translate(safeOriginal, 'en', sourceLang).subscribe({
      next: (result) => {
        if (result?.error) {
          this.updateSegment(id, { translated: '', translating: false });
          this.errorMessage.set(`⚠️ Translation unavailable: ${result.error}`);
        } else {
          this.updateSegment(id, { translated: result.translatedText || '', translating: false });
        }
        this.pendingTranslations = Math.max(0, this.pendingTranslations - 1);
        this.isTranslating.set(this.pendingTranslations > 0);
        this.rebuildDisplayStrings();
      },
      error: (err) => {
        console.error('Error translating segment:', err);
        this.updateSegment(id, { translated: '', translating: false });
        this.pendingTranslations = Math.max(0, this.pendingTranslations - 1);
        this.isTranslating.set(this.pendingTranslations > 0);
        this.rebuildDisplayStrings();
      }
    });
  }

  private updateSegment(id: number, patch: Partial<{ translated: string; translating: boolean }>): void {
    const current = this.segments();
    const idx = current.findIndex(s => s.id === id);
    if (idx < 0) return;
    const updated = [...current];
    updated[idx] = { ...updated[idx], ...patch };
    this.segments.set(updated);
  }

  private rebuildDisplayStrings(): void {
    if (this.manualMode()) {
      // Manual mode uses the raw editable text and translatedText set by translateTextOnce()
      return;
    }

    const originals: string[] = [];
    originals.push(...this.segments().map(s => s.original));
    const interim = this.interimOriginal();
    if (interim) originals.push(interim);
    this.originalText.set(originals.join('\n'));

    const translations: string[] = [];
    translations.push(
      ...this.segments().map(s => {
        if (s.translating && (!s.translated || s.translated.trim().length === 0)) {
          return '⏳ Translating…';
        }
        return s.translated ?? '';
      })
    );
    const interimT = this.interimTranslated();
    if (interimT) translations.push(interimT);
    this.translatedText.set(translations.join('\n'));
  }

  private scheduleAutoScrollToLatest(): void {
    // Coalesce many updates into one scroll.
    this.clearScrollScheduleTimer();
    this.scrollScheduleTimer = setTimeout(() => {
      this.scrollScheduleTimer = null;
      // Double-rAF ensures layout has settled and textarea.value is applied.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scrollOutputsToLatest());
      });
    }, 0);
  }

  private clearScrollScheduleTimer(): void {
    if (this.scrollScheduleTimer) {
      clearTimeout(this.scrollScheduleTimer);
      this.scrollScheduleTimer = null;
    }
  }

  private scrollOutputsToLatest(): void {
    this.scrollTextareaToBottom(this.originalBox?.nativeElement);
    this.scrollTextareaToBottom(this.translatedBox?.nativeElement);
  }

  private scrollTextareaToBottom(el?: HTMLTextAreaElement): void {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  private truncateForQuery(text: string, maxChars: number): string {
    const t = (text || '').trim();
    if (t.length <= maxChars) return t;
    // Prefer cutting at a word boundary when possible
    const slice = t.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.6) return slice.slice(0, lastSpace).trim();
    return slice.trim();
  }

  private packIntoChunks(parts: string[], maxChars: number): string[] {
    const out: string[] = [];
    let buf = '';

    const flush = () => {
      const t = buf.trim();
      if (t) out.push(...this.chunkText(t, maxChars));
      buf = '';
    };

    for (const raw of parts) {
      const p = (raw || '').trim();
      if (!p) continue;

      if (!buf) {
        buf = p;
        continue;
      }

      // Try adding with a space
      const candidate = `${buf} ${p}`.trim();
      if (candidate.length <= maxChars) {
        buf = candidate;
      } else {
        flush();
        buf = p;
      }
    }
    flush();
    return out;
  }

  private chunkText(text: string, maxChars: number): string[] {
    const t = (text || '').trim();
    if (!t) return [];
    if (t.length <= maxChars) return [t];

    const chunks: string[] = [];
    let remaining = t;
    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars);
      const lastSpace = slice.lastIndexOf(' ');
      const cutAt = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
      const chunk = remaining.slice(0, cutAt).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(cutAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }
}
