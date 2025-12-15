import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private transcriptSubject = new Subject<{ text: string, isFinal: boolean }>();
  private isListeningSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new Subject<string>();
  private isManuallyStopped: boolean = false;
  private listeningTimeout: any = null;
  private listeningDuration: number = 120000; // 120 seconds in milliseconds
  private shouldBeListening: boolean = false;
  private isRecognizing: boolean = false;
  private restartTimeout: any = null;
  private restartAttempts: number = 0;
  private isMobileDevice: boolean = false;
  private lastNonCriticalError: string | null = null;

  public transcript$ = this.transcriptSubject.asObservable();
  public isListening$ = this.isListeningSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor() {
    this.isMobileDevice = this.detectMobileDevice();
    this.initializeRecognition();
  }

  private detectMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  private initializeRecognition(): void {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Emit transcripts with final status
          if (finalTranscript.trim()) {
            console.log('[SpeechRecognition] Final transcript:', finalTranscript.trim());
            this.transcriptSubject.next({ text: finalTranscript.trim(), isFinal: true });
          }

          if (interimTranscript.trim()) {
            console.log('[SpeechRecognition] Interim transcript:', interimTranscript.trim());
            this.transcriptSubject.next({ text: interimTranscript.trim(), isFinal: false });
          }

          // Treat the 120s timeout as an inactivity timer:
          // whenever we get *any* speech result, reset the 120s timer.
          if ((finalTranscript.trim() || interimTranscript.trim()) && this.shouldBeListening) {
            this.startListeningTimeout();
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          // NOTE: Chrome/Edge frequently emit `no-speech` during natural pauses.
          // Treat it as a normal condition; the engine may still fire `onend`.
          if (event.error === 'no-speech') {
            this.lastNonCriticalError = 'no-speech';
            console.debug('[SpeechRecognition] no-speech (continuing)');
            return;
          }

          this.lastNonCriticalError = event.error || null;
          console.warn('[SpeechRecognition] error:', event.error);

          // Only stop on critical errors, not on "no-speech" which happens during pauses
          const criticalErrors = ['not-allowed', 'audio-capture', 'service-not-allowed'];

          if (criticalErrors.includes(event.error)) {
            this.errorSubject.next(event.error);
            this.stopListening();
          } else {
            // For other errors, emit them but don't stop listening
            this.errorSubject.next(event.error);
          }
        };

        this.recognition.onstart = () => {
          console.log('[SpeechRecognition] Started listening');
          this.isRecognizing = true;
          this.restartAttempts = 0;
          this.isListeningSubject.next(true);
        };

        this.recognition.onend = () => {
          console.log('[SpeechRecognition] Recognition ended, isManuallyStopped:', this.isManuallyStopped);
          this.isRecognizing = false;

          // If manually stopped or we no longer want to listen, don't restart
          if (this.isManuallyStopped || !this.shouldBeListening) {
            this.isListeningSubject.next(false);
            this.clearListeningTimeout();
            return;
          }

          // Automatically restart listening for continuous operation.
          // Use a small backoff to avoid "already started" / rapid end loops.
          this.scheduleRestart();
        };
      } else {
        console.warn('Speech recognition not supported in this browser');
        this.errorSubject.next('Speech recognition not supported');
      }
    }
  }

  async requestMicrophonePermission(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      return false;
    }
  }

  async startListening(language: string = 'en-US'): Promise<void> {
    console.log('[SpeechRecognition] ========================================');
    console.log('[SpeechRecognition] startListening called with language:', language);
    console.log('[SpeechRecognition] Current recognition state:', this.recognition ? 'initialized' : 'not initialized');
    console.log('[SpeechRecognition] ========================================');

    if (!this.recognition) {
      console.error('[SpeechRecognition] Recognition not available!');
      this.errorSubject.next('Speech recognition not available');
      return;
    }

    this.shouldBeListening = true;

    // Request microphone permission first
    try {
      console.log('[SpeechRecognition] Requesting microphone permission...');
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        console.error('[SpeechRecognition] Microphone permission denied');
        this.errorSubject.next('not-allowed');
        return;
      }
      console.log('[SpeechRecognition] Microphone permission granted');
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error);
      this.errorSubject.next('not-allowed');
      return;
    }

    try {
      this.isManuallyStopped = false;
      this.recognition.lang = language;
      console.log('[SpeechRecognition] *** Set recognition language to:', language, '***');
      console.log('[SpeechRecognition] Starting recognition.start()...');
      this.startRecognitionSafely('startListening');
      this.startListeningTimeout();
      console.log('[SpeechRecognition] Recognition start() called successfully');
    } catch (error: any) {
      console.error('[SpeechRecognition] Error in start():', error);
      this.errorSubject.next(error.message || 'Failed to start listening');
    }
  }

  stopListening(): void {
    this.isManuallyStopped = true;
    this.shouldBeListening = false;
    this.clearRestartTimeout();
    this.clearListeningTimeout();
    if (this.recognition && this.isListeningSubject.value) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  private scheduleRestart(): void {
    this.clearRestartTimeout();

    // On mobile, Chrome/OS often plays an audible "beep" when speech recognition
    // restarts. We cannot disable that beep from JS, so the best mitigation is to
    // restart LESS frequently (larger backoff), especially after `no-speech` loops.
    const base = this.isMobileDevice ? 1500 : 300;
    const step = this.isMobileDevice ? 500 : 250;
    const cap = this.isMobileDevice ? 5000 : 2000;

    const extraNoSpeechPenalty = (this.isMobileDevice && this.lastNonCriticalError === 'no-speech') ? 1000 : 0;
    const delay = Math.min(base + this.restartAttempts * step + extraNoSpeechPenalty, cap);

    this.restartAttempts += 1;

    this.restartTimeout = setTimeout(() => {
      if (!this.shouldBeListening || this.isManuallyStopped || !this.recognition) {
        return;
      }
      this.lastNonCriticalError = null;
      this.startRecognitionSafely('onend-restart');
    }, delay);
  }

  private clearRestartTimeout(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }

  private startRecognitionSafely(reason: string): void {
    if (!this.recognition) return;
    if (this.isRecognizing) return;

    try {
      console.log(`[SpeechRecognition] start() (${reason})`);
      this.recognition.start();
    } catch (error) {
      // Chrome can throw if start() is called too quickly
      console.log('[SpeechRecognition] start() failed (will retry):', error);
      this.scheduleRestart();
    }
  }

  private startListeningTimeout(): void {
    this.clearListeningTimeout();

    // Set a timeout to stop listening after 120 seconds
    this.listeningTimeout = setTimeout(() => {
      console.log('Listening timeout reached (120 seconds). Stopping...');
      this.isManuallyStopped = true;
      if (this.recognition) {
        try {
          this.recognition.stop();
          this.errorSubject.next('timeout');
        } catch (error) {
          console.error('Error stopping after timeout:', error);
        }
      }
    }, this.listeningDuration);
  }

  private clearListeningTimeout(): void {
    if (this.listeningTimeout) {
      clearTimeout(this.listeningTimeout);
      this.listeningTimeout = null;
    }
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

}

