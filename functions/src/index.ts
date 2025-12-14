import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { TranslationServiceClient } from '@google-cloud/translate';

admin.initializeApp();

// Initialize Google Cloud Translation client v3
// Uses Application Default Credentials from Firebase
const translationClient = new TranslationServiceClient({
  projectId: 'translate-to-english-80cad'
});

// Detect language using Google Cloud Translation API v3
export const detectLanguage = functions.https.onRequest((req, res) => {
  // Set CORS headers first
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  (async () => {
    try {
      const { text } = req.query;

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text parameter is required' });
        return;
      }

      const projectId = 'translate-to-english-80cad';
      const location = 'global';

      const [response] = await translationClient.detectLanguage({
        parent: `projects/${projectId}/locations/${location}`,
        content: text,
        mimeType: 'text/plain',
      });

      const language = response.languages?.[0]?.languageCode || 'en';
      const confidence = response.languages?.[0]?.confidence || 1;

      res.json({
        language,
        confidence: confidence
      });
    } catch (error: any) {
      console.error('Error detecting language:', error);
      res.status(500).json({ error: error.message || 'Failed to detect language' });
    }
  })();
});

// Translate text using Google Cloud Translation API v3
export const translateText = functions.https.onRequest((req, res) => {
  // Set CORS headers first
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  (async () => {
    try {
      const { text, targetLanguage = 'en', sourceLanguage } = req.query;

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text parameter is required' });
        return;
      }

      const projectId = 'translate-to-english-80cad';
      const location = 'global';

      const request: any = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [text],
        mimeType: 'text/plain',
        targetLanguageCode: targetLanguage,
      };

      if (sourceLanguage && sourceLanguage !== 'auto') {
        request.sourceLanguageCode = sourceLanguage;
      }

      const [response] = await translationClient.translateText(request);
      const translation = response.translations?.[0]?.translatedText || text;
      const detectedLanguage = response.translations?.[0]?.detectedLanguageCode || sourceLanguage || 'auto';

      res.json({
        translatedText: translation,
        sourceLanguage: detectedLanguage,
        targetLanguage
      });
    } catch (error: any) {
      console.error('Error translating text:', error);
      res.status(500).json({ error: error.message || 'Failed to translate text' });
    }
  })();
});

