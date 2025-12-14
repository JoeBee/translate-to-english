import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextToSpeechService {
  private synth: SpeechSynthesis;
  private isSpeaking = false;
  private speechQueue: string[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
    } else {
      this.synth = null as any;
    }
  }

  speak(text: string, language: string = 'en-US'): void {
    if (!this.isSupported()) {
      console.warn('Text-to-speech not supported in this browser');
      return;
    }

    // Cancel any current speech, but don't clear queue if same text
    // This prevents interruption loops
    if (this.isSpeaking) {
      this.synth.cancel();
      // Wait a brief moment for cancellation to complete
      setTimeout(() => {
        this.processNewUtterance(text, language);
      }, 50);
      return;
    }

    this.processNewUtterance(text, language);
  }

  private processNewUtterance(text: string, language: string = 'en-US'): void {
    // Clear any pending speech for now
    this.speechQueue = [];

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      // Process next item in queue if any
      if (this.speechQueue.length > 0) {
        const nextText = this.speechQueue.shift();
        if (nextText) {
          // Small delay to ensure clean transition
          setTimeout(() => {
            this.speak(nextText, language);
          }, 100);
        }
      }
    };

    utterance.onerror = (error) => {
      // "interrupted" and "not-allowed" errors are expected
      // Don't log or make noise about them
      if (error.error === 'interrupted') {
        // Normal - user spoke again while TTS was playing
        console.log('[TTS] Speech interrupted (normal)');
      } else if (error.error === 'not-allowed') {
        // Browser blocked autoplay - this is OK, just don't speak
        console.log('[TTS] Speech not allowed by browser (autoplay policy)');
      } else {
        console.warn('[TTS] Speech synthesis error:', error.error);
      }
      this.isSpeaking = false;

      // Process next item in queue if any, even after error
      if (this.speechQueue.length > 0 && error.error !== 'interrupted') {
        const nextText = this.speechQueue.shift();
        if (nextText) {
          // Small delay before retrying to avoid rapid errors
          setTimeout(() => {
            this.speak(nextText, language);
          }, 100);
        }
      }
    };

    this.synth.speak(utterance);
  }

  speakQueue(texts: string[], language: string = 'en-US'): void {
    if (texts.length === 0) return;

    // If not currently speaking, start with first item
    if (!this.isSpeaking) {
      const firstText = texts.shift();
      if (firstText) {
        this.speak(firstText, language);
      }
    }

    // Add remaining items to queue
    this.speechQueue.push(...texts);
  }

  stop(): void {
    if (this.isSupported() && this.synth) {
      this.synth.cancel();
      this.speechQueue = [];
      this.isSpeaking = false;
    }
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return 'speechSynthesis' in window && this.synth !== null;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

