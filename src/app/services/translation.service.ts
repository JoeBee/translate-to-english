import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

export interface Language {
  code: string;
  name: string;
  webSpeechSupported: boolean;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private functionsUrl: string;
  private translationCache: Map<string, string> = new Map();
  private isEmulatorUrl(url: string): boolean {
    try {
      const u = new URL(url);
      // Firebase functions emulator defaults to 5001 and uses /<project>/us-central1
      return u.port === '5001' || u.pathname.includes('/us-central1');
    } catch {
      return url.includes(':5001') || url.includes('/us-central1');
    }
  }

  // Supported languages with their codes
  public readonly languages: Language[] = [
    // European languages
    { code: 'en', name: 'English', webSpeechSupported: true },
    { code: 'es', name: 'Spanish', webSpeechSupported: true },
    { code: 'fr', name: 'French', webSpeechSupported: true },
    { code: 'de', name: 'German', webSpeechSupported: true },
    { code: 'it', name: 'Italian', webSpeechSupported: true },
    { code: 'pt', name: 'Portuguese', webSpeechSupported: true },
    { code: 'ru', name: 'Russian', webSpeechSupported: true },
    { code: 'nl', name: 'Dutch', webSpeechSupported: false },
    { code: 'pl', name: 'Polish', webSpeechSupported: false },
    { code: 'sv', name: 'Swedish', webSpeechSupported: false },
    { code: 'da', name: 'Danish', webSpeechSupported: false },
    { code: 'no', name: 'Norwegian', webSpeechSupported: false },
    { code: 'fi', name: 'Finnish', webSpeechSupported: false },
    { code: 'el', name: 'Greek', webSpeechSupported: false },
    { code: 'cs', name: 'Czech', webSpeechSupported: false },
    { code: 'hu', name: 'Hungarian', webSpeechSupported: false },
    { code: 'ro', name: 'Romanian', webSpeechSupported: false },

    // Asian languages
    { code: 'zh', name: 'Chinese', webSpeechSupported: true },
    { code: 'ja', name: 'Japanese', webSpeechSupported: true },
    { code: 'ko', name: 'Korean', webSpeechSupported: true },
    { code: 'hi', name: 'Hindi', webSpeechSupported: true },
    { code: 'ar', name: 'Arabic', webSpeechSupported: true },
    { code: 'th', name: 'Thai', webSpeechSupported: true },
    { code: 'vi', name: 'Vietnamese', webSpeechSupported: true },
    { code: 'id', name: 'Indonesian', webSpeechSupported: true },
    { code: 'ms', name: 'Malay', webSpeechSupported: false },

    // Southeast Asian languages
    { code: 'lo', name: 'Lao', webSpeechSupported: false },
    { code: 'km', name: 'Khmer (Cambodian)', webSpeechSupported: false },
    { code: 'my', name: 'Myanmar (Burmese)', webSpeechSupported: false },
    { code: 'tl', name: 'Filipino', webSpeechSupported: false },

    // Other common languages
    { code: 'tr', name: 'Turkish', webSpeechSupported: false },
    { code: 'he', name: 'Hebrew', webSpeechSupported: false },
    { code: 'uk', name: 'Ukrainian', webSpeechSupported: false },
  ];

  constructor(
    private http: HttpClient,
    private storageService: StorageService
  ) {
    // Use emulator in development if enabled, otherwise use production
    if (!environment.production && environment.useEmulator) {
      // If the app is opened on another device (e.g. phone) while using the emulator,
      // `localhost` will point at that device, not your dev machine. In that case,
      // rewrite the emulator host to match the page host (typically your PC's LAN IP).
      this.functionsUrl = environment.functionsUrl;
      try {
        const pageHost =
          typeof window !== 'undefined' && window.location?.hostname
            ? window.location.hostname
            : '';
        if (pageHost) {
          const u = new URL(this.functionsUrl);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            u.hostname = pageHost;
            this.functionsUrl = u.toString().replace(/\/$/, '');
          }
        }
      } catch {
        // Keep the configured URL if parsing fails
      }
    } else {
      this.functionsUrl = 'https://us-central1-translate-to-english-80cad.cloudfunctions.net';
    }
    console.log('Translation service using functions URL:', this.functionsUrl);
    this.loadCache();
  }


  // Mock translation for development (no API needed)
  private mockTranslate(text: string, targetLanguage: string = 'en', sourceLanguage?: string): Observable<TranslationResult> {
    // Simulate API delay
    return new Observable(observer => {
      setTimeout(() => {
        // Mock translation - for development only
        // In production, this would use Google Cloud Translation API
        // For development, provide basic mock translations for common phrases

        // Detect source language if not provided
        const detectedLang = sourceLanguage || this.simpleLanguageDetection(text);

        // Basic mock translations for common Spanish phrases (for testing)
        // IMPORTANT: We translate FROM sourceLanguage TO targetLanguage
        let translated = text;

        // Only translate if source language is different from target language
        if (detectedLang !== targetLanguage) {
          if (detectedLang === 'es' && targetLanguage === 'en') {
            const mockTranslations: { [key: string]: string } = {
              'cómo está': 'how are you',
              'cómo estás': 'how are you',
              'hola': 'hello',
              'gracias': 'thank you',
              'por favor': 'please',
              'buenos días': 'good morning',
              'buenas tardes': 'good afternoon',
              'buenas noches': 'good night',
              'adiós': 'goodbye',
              'sí': 'yes',
              'no': 'no'
            };

            const lowerText = text.toLowerCase().trim();
            // Try exact match first
            if (mockTranslations[lowerText]) {
              translated = mockTranslations[lowerText];
            } else {
              // Try partial match for phrases like "cómo está" (might have extra spaces)
              const normalizedText = lowerText.replace(/\s+/g, ' ').trim();
              if (mockTranslations[normalizedText]) {
                translated = mockTranslations[normalizedText];
              } else {
                // For other Spanish text, return as-is (no prefix)
                translated = text;
              }
            }
          } else if (detectedLang !== 'en' && targetLanguage === 'en') {
            // For other languages, return as-is (no prefix)
            translated = text;
          }
        }
        // If source is same as target, return as-is

        const result: TranslationResult = {
          translatedText: translated,
          sourceLanguage: detectedLang,
          targetLanguage
        };

        console.log('[TranslationService] Mock translation result:', result);
        console.log(`[TranslationService] Translated "${text}" (${detectedLang}) → "${translated}" (${targetLanguage})`);

        // Cache the result
        const cacheKey = `translate_${sourceLanguage || 'auto'}_${targetLanguage}_${text}`;
        this.translationCache.set(cacheKey, JSON.stringify(result));
        this.saveCache();

        observer.next(result);
        observer.complete();
      }, 300); // Simulate network delay
    });
  }

  // Simple fallback language detection based on character patterns
  private simpleLanguageDetection(text: string): string {
    // Very basic detection - just for development/fallback
    const trimmed = text.trim().toLowerCase();

    // Check for non-Latin scripts
    if (/[\u4e00-\u9fff]/.test(trimmed)) return 'zh'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) return 'ja'; // Japanese
    if (/[\uac00-\ud7af]/.test(trimmed)) return 'ko'; // Korean
    if (/[\u0600-\u06ff]/.test(trimmed)) return 'ar'; // Arabic
    if (/[\u0e00-\u0e7f]/.test(trimmed)) return 'th'; // Thai
    if (/[\u0900-\u097f]/.test(trimmed)) return 'hi'; // Hindi

    // Check for common Spanish patterns
    if (/[áéíóúñ¿¡]/.test(trimmed) || /^(hola|gracias|por favor|como|esta|que|el|la|los|las|bueno|es|soy|tengo)/i.test(trimmed)) return 'es';

    // Check for common French patterns
    if (/[àâäéèêëïîôùûüÿç]/.test(trimmed) || /^(bonjour|merci|s'il vous plait|comment|est|que|le|la|les|je suis|j'ai|bien)/i.test(trimmed)) return 'fr';

    // Check for common German patterns
    if (/[äöüß]/.test(trimmed) || /^(hallo|danke|bitte|wie|ist|was|der|die|das|gut|ich bin|ich habe)/i.test(trimmed)) return 'de';

    // Check for common Italian patterns
    if (/[àèéìíîòóùú]/.test(trimmed) || /^(ciao|grazie|per favore|come|è|che|il|la|lo|gli|bene|sono|ho)/i.test(trimmed)) return 'it';

    // Check for common Portuguese patterns
    if (/[ãõáéíóúâêôç]/.test(trimmed) || /^(olá|obrigado|por favor|como|é|que|o|a|os|as|bom|sou|tenho)/i.test(trimmed)) return 'pt';

    // Check for common Russian patterns
    if (/[а-яё]/i.test(trimmed) || /^(привет|спасибо|пожалуйста|как|что|это|хорошо|я)/i.test(trimmed)) return 'ru';

    // Default to English for Latin scripts
    return 'en';
  }

  translate(text: string, targetLanguage: string = 'en', sourceLanguage?: string): Observable<TranslationResult> {
    if (!text || text.trim().length === 0) {
      return of({ translatedText: '', sourceLanguage: sourceLanguage || 'auto', targetLanguage });
    }

    // Log translation request
    console.log(`[TranslationService] Translating FROM "${sourceLanguage || 'auto'}" TO "${targetLanguage}":`, text);

    const cacheKey = `translate_${sourceLanguage || 'auto'}_${targetLanguage}_${text}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      try {
        const result = JSON.parse(cached);
        // Validate cache entry: if translatedText is same as input text AND we're translating between different languages, it's a bad cache
        const sourceLang = sourceLanguage || result.sourceLanguage || 'auto';
        const isBadCache = result.translatedText === text &&
          sourceLang !== 'auto' &&
          sourceLang !== targetLanguage;

        if (isBadCache) {
          console.warn('[TranslationService] Invalid cache entry detected (translatedText === input), ignoring:', result);
          console.warn('[TranslationService] Source:', sourceLang, 'Target:', targetLanguage, 'Text:', text);
          // Remove bad cache entry
          this.translationCache.delete(cacheKey);
          this.saveCache();
          // Continue to perform actual translation
        } else {
          console.log('[TranslationService] Using cached translation:', result);
          return of(result);
        }
      } catch (e) {
        // Invalid cache entry - remove it
        console.warn('[TranslationService] Corrupted cache entry, removing:', cacheKey);
        this.translationCache.delete(cacheKey);
        this.saveCache();
      }
    }

    // Use mock translation in development if enabled, but fall back to real API if mock can't translate
    if (!environment.production && environment.useMockTranslation) {
      console.log('[TranslationService] Using mock translation (development mode)');
      return this.mockTranslate(text, targetLanguage, sourceLanguage).pipe(
        switchMap(result => {
          // If mock translation returned the same text and we're translating between different languages,
          // it means mock couldn't translate - fall back to real API only if not using localhost
          const sourceLang = sourceLanguage || result.sourceLanguage || 'auto';
          const mockFailed = result.translatedText === text &&
            sourceLang !== 'auto' &&
            sourceLang !== targetLanguage;

          if (mockFailed) {
            // If we're using the emulator (even via LAN IP), prefer MyMemory fallback for mock misses.
            // This keeps development usable on phones even when the emulator isn't reachable.
            const isEmulator = this.isEmulatorUrl(this.functionsUrl) || this.functionsUrl.includes('localhost');

            if (isEmulator) {
              // Use free public API (MyMemory) as fallback for localhost development
              // This ensures translation works without emulator
              console.log('[TranslationService] Mock translation failed, using MyMemory API fallback');
              return this.translateWithMyMemory(text, targetLanguage, sourceLang);
            } else {
              // Try real API fallback for production URLs
              console.log('[TranslationService] Mock translation failed (no match found), falling back to real API');
              return this.callRealTranslationAPI(text, targetLanguage, sourceLanguage, cacheKey);
            }
          } else {
            // Mock translation succeeded, return it
            return of(result);
          }
        })
      );
    }

    // Call real translation API
    return this.callRealTranslationAPI(text, targetLanguage, sourceLanguage, cacheKey);
  }

  // Free public API fallback for development (MyMemory API)
  private translateWithMyMemory(text: string, targetLanguage: string, sourceLanguage: string): Observable<TranslationResult> {
    // If we've already hit MyMemory quota today, avoid repeated calls.
    try {
      const disabledUntilRaw = localStorage.getItem('mymemory_disabled_until');
      const disabledUntil = disabledUntilRaw ? Number(disabledUntilRaw) : 0;
      if (disabledUntil && Date.now() < disabledUntil) {
        return of({
          translatedText: '',
          sourceLanguage,
          targetLanguage,
          error: 'MyMemory daily free quota reached (temporarily disabled).'
        });
      }
    } catch {
      // ignore storage issues
    }

    // Handle auto-detect for MyMemory
    const source = sourceLanguage === 'auto' ? '' : sourceLanguage;
    const langPair = source ? `${source}|${targetLanguage}` : `|${targetLanguage}`; // If auto, use format |target

    // MyMemory API URL (free usage limit: 5000 chars/day)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    console.log('[TranslationService] Using MyMemory API fallback:', url);

    return this.http.get<any>(url).pipe(
      map(response => {
        // MyMemory can return quota warnings in responseDetails even with a responseData payload.
        const details = (response?.responseDetails || response?.responseStatus || '').toString();
        const warning = (details || '').toLowerCase().includes('you used all available free translations for today');
        if (warning) {
          // Disable until next local midnight to prevent hammering the endpoint.
          try {
            const now = new Date();
            const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime();
            localStorage.setItem('mymemory_disabled_until', String(nextMidnight));
          } catch {
            // ignore
          }
          return {
            translatedText: '',
            sourceLanguage,
            targetLanguage,
            error: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.'
          };
        }

        if (response && response.responseData && response.responseData.translatedText) {
          return {
            translatedText: response.responseData.translatedText,
            sourceLanguage: sourceLanguage, // MyMemory doesn't reliably return detected source in this endpoint
            targetLanguage: targetLanguage
          };
        }
        throw new Error('Invalid response from MyMemory API');
      }),
      catchError(error => {
        console.error('[TranslationService] MyMemory API error:', error);
        return of({
          translatedText: text,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          error: 'External translation API failed'
        });
      })
    );
  }

  private callRealTranslationAPI(text: string, targetLanguage: string, sourceLanguage: string | undefined, cacheKey: string): Observable<TranslationResult> {
    // Check if functions URL is configured
    if (
      !this.functionsUrl ||
      this.functionsUrl.includes('YOUR_') ||
      (!this.functionsUrl.includes('cloudfunctions.net') && !this.isEmulatorUrl(this.functionsUrl) && !this.functionsUrl.includes('localhost'))
    ) {
      console.warn('Firebase Functions URL not configured. Cannot translate.');
      return of({
        translatedText: text,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
        error: 'Firebase Functions not configured. Please configure your Firebase Functions URL in environment.ts'
      });
    }

    let url = `${this.functionsUrl}/translateText?text=${encodeURIComponent(text)}&targetLanguage=${targetLanguage}`;
    if (sourceLanguage && sourceLanguage !== 'auto') {
      url += `&sourceLanguage=${sourceLanguage}`;
    }

    console.log('[TranslationService] Making API request to:', url);

    return this.http.get<TranslationResult>(url).pipe(
      map(result => {
        // Cache the result
        this.translationCache.set(cacheKey, JSON.stringify(result));
        this.saveCache();
        return result;
      }),
      catchError(error => {
        // Handle status 0 (CORS/network) and 404 (not deployed) errors
        const status = error?.status || 0;
        const errorMessage = error?.message || '';
        const isConnectionRefused = errorMessage.includes('ERR_CONNECTION_REFUSED') ||
          errorMessage.includes('Connection refused') ||
          (this.functionsUrl.includes('localhost') && status === 0);

        let errorMsg = 'Unknown error';

        if (isConnectionRefused) {
          // Connection refused - emulator probably not running
          errorMsg = 'Translation service unavailable: Firebase Functions emulator is not running. Start it with: firebase emulators:start --only functions';
          // Only log a simple message, not full error details
          console.warn('[TranslationService] Connection refused - emulator may not be running');
        } else if (status === 0) {
          // CORS or network error
          errorMsg = 'CORS/Network error: Firebase Functions may not be deployed or CORS is not configured.';
          console.error('[TranslationService] Network error:', errorMessage);
        } else if (status === 404) {
          // Function not found
          errorMsg = 'Function not found (404): Firebase Functions may not be deployed.';
          console.error('[TranslationService] Function not found');
        } else if (error?.error?.error) {
          errorMsg = error.error.error;
          console.error('[TranslationService] Translation error:', errorMsg);
        } else if (error?.message) {
          errorMsg = error.message;
          console.error('[TranslationService] Translation error:', errorMsg);
        } else if (error?.statusText) {
          errorMsg = `${status}: ${error.statusText}`;
          console.error('[TranslationService] Translation error:', errorMsg);
        }

        // Return original text if translation fails
        return of({
          translatedText: text,
          sourceLanguage: sourceLanguage || 'auto',
          targetLanguage,
          error: errorMsg
        });
      })
    );
  }

  getLanguageByCode(code: string): Language | undefined {
    return this.languages.find(lang => lang.code === code);
  }

  getLanguageName(code: string): string {
    const language = this.getLanguageByCode(code);
    return language ? language.name : code;
  }

  // Convert language code to Web Speech API format (e.g., 'es' -> 'es-ES')
  toWebSpeechCode(languageCode: string): string {
    const mappings: { [key: string]: string } = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'id': 'id-ID',
    };
    return mappings[languageCode] || `${languageCode}-${languageCode.toUpperCase()}`;
  }

  private loadCache(): void {
    try {
      const cached = localStorage.getItem('translation_cache');
      if (cached) {
        const cache = JSON.parse(cached);
        this.translationCache = new Map(Object.entries(cache));
      }
    } catch (error) {
      console.error('Error loading translation cache:', error);
    }
  }

  private saveCache(): void {
    try {
      // Limit cache size to prevent storage issues
      if (this.translationCache.size > 100) {
        const entries = Array.from(this.translationCache.entries());
        const recentEntries = entries.slice(-50); // Keep last 50
        this.translationCache = new Map(recentEntries);
      }

      const cacheObj = Object.fromEntries(this.translationCache);
      localStorage.setItem('translation_cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Error saving translation cache:', error);
    }
  }
}

