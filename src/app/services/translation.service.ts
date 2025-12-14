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

export interface DetectionResult {
  language: string;
  confidence: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private functionsUrl: string;
  private translationCache: Map<string, string> = new Map();

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
      this.functionsUrl = environment.functionsUrl; // Already set to emulator URL
    } else {
      this.functionsUrl = 'https://us-central1-translate-to-english-80cad.cloudfunctions.net';
    }
    console.log('Translation service using functions URL:', this.functionsUrl);
    this.loadCache();
  }

  detectLanguage(text: string): Observable<DetectionResult> {
    if (!text || text.trim().length === 0) {
      return of({ language: 'en', confidence: 0 });
    }

    const cacheKey = `detect_${text}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      try {
        const result = JSON.parse(cached);
        return of(result);
      } catch (e) {
        // Invalid cache entry
      }
    }

    // Use mock translation in development if enabled
    if (!environment.production && environment.useMockTranslation) {
      console.log('Using mock language detection (development mode)');
      return this.mockDetectLanguage(text);
    }

    // Check if functions URL is configured
    if (!this.functionsUrl || this.functionsUrl.includes('YOUR_') || (!this.functionsUrl.includes('cloudfunctions.net') && !this.functionsUrl.includes('localhost'))) {
      console.warn('Firebase Functions URL not configured. Using fallback language detection.');
      // Simple fallback: try to detect based on common patterns
      const detected = this.simpleLanguageDetection(text);
      return of({ language: detected, confidence: 0.5, error: 'Firebase Functions not configured' });
    }

    const url = `${this.functionsUrl}/detectLanguage?text=${encodeURIComponent(text)}`;
    
    return this.http.get<DetectionResult>(url).pipe(
      map(result => {
        // Cache the result
        this.translationCache.set(cacheKey, JSON.stringify(result));
        this.saveCache();
        return result;
      }),
      catchError(error => {
        console.error('Error detecting language:', error);
        console.error('Error details:', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          url: error?.url,
          error: error?.error
        });
        
        // Handle status 0 (CORS/network) and 404 (not deployed) errors
        const status = error?.status || 0;
        let errorMsg = 'Unknown error';
        
        if (status === 0) {
          // CORS or network error
          errorMsg = 'CORS/Network error: Firebase Functions may not be deployed or CORS is not configured. Status 0 typically means the request was blocked.';
        } else if (status === 404) {
          // Function not found
          errorMsg = 'Function not found (404): Firebase Functions may not be deployed. Please deploy functions using: firebase deploy --only functions';
        } else if (error?.error?.error) {
          errorMsg = error.error.error;
        } else if (error?.message) {
          errorMsg = error.message;
        } else if (error?.statusText) {
          errorMsg = `${status}: ${error.statusText}`;
        }
        
        console.error('Language detection failed:', errorMsg);
        
        // Try simple fallback detection
        const detected = this.simpleLanguageDetection(text);
        console.log('Using fallback detection:', detected);
        
        // Return default on error - we'll proceed with auto-detect
        return of({ language: detected, confidence: 0.3, error: errorMsg });
      })
    );
  }

  // Mock language detection for development (no API needed)
  private mockDetectLanguage(text: string): Observable<DetectionResult> {
    // Simulate API delay
    return new Observable(observer => {
      setTimeout(() => {
        const detected = this.simpleLanguageDetection(text);
        const result: DetectionResult = {
          language: detected,
          confidence: 0.85
        };
        
        // Cache the result
        const cacheKey = `detect_${text}`;
        this.translationCache.set(cacheKey, JSON.stringify(result));
        this.saveCache();
        
        observer.next(result);
        observer.complete();
      }, 200); // Simulate network delay
    });
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
            // Only try fallback if not using localhost (emulator might not be running)
            const isLocalhost = this.functionsUrl.includes('localhost');
            
            if (isLocalhost) {
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
    // Handle auto-detect for MyMemory
    const source = sourceLanguage === 'auto' ? '' : sourceLanguage;
    const langPair = source ? `${source}|${targetLanguage}` : `|${targetLanguage}`; // If auto, use format |target
    
    // MyMemory API URL (free usage limit: 5000 chars/day)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    console.log('[TranslationService] Using MyMemory API fallback:', url);
    
    return this.http.get<any>(url).pipe(
      map(response => {
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
    if (!this.functionsUrl || this.functionsUrl.includes('YOUR_') || (!this.functionsUrl.includes('cloudfunctions.net') && !this.functionsUrl.includes('localhost'))) {
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

