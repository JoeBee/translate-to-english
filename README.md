# Translate to English - Real-time Translation PWA

A Progressive Web App (PWA) that listens to speech, detects the spoken language, translates to English, and speaks the translation out loud.

## Features

- **Speech Recognition**: Listen to words being spoken using Web Speech API
- **Language Detection**: Automatically detects the spoken language using Google Cloud Translation API
- **Real-time Translation**: Translates detected speech to English in real-time
- **Text-to-Speech**: Speaks the English translation out loud
- **Language Selection**: Dropdown with 30+ languages including Southeast Asian languages
- **PWA Support**: Works offline (cached translations) and installable on mobile devices
- **Local Storage**: User preferences and translation history stored locally

## Supported Languages

### European Languages
English, Spanish, French, German, Italian, Portuguese, Russian, Dutch, Polish, Swedish, Danish, Norwegian, Finnish, Greek, Czech, Hungarian, Romanian

### Asian Languages
Chinese, Japanese, Korean, Hindi, Arabic

### Southeast Asian Languages
Thai, Vietnamese, Indonesian, Malay, Lao, Khmer (Cambodian), Myanmar (Burmese), Filipino

## Setup

### Prerequisites
- Node.js (v20+)
- Firebase CLI installed
- Google Cloud Translation API enabled in Firebase project

### Installation

1. Install dependencies:
```bash
npm install
cd functions
npm install
cd ..
```

2. Configure Firebase:
- Update `src/environments/environment.ts` with your Firebase config
- Update `src/environments/environment.prod.ts` with production Firebase config

3. Set up Google Cloud Translation API:
- Enable Translation API in Google Cloud Console
- The Firebase Functions will use Application Default Credentials

4. Generate PWA icons (optional):
- The app uses `favicon.ico` as a fallback icon
- For production, create proper icon files (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512, 180x180) and place them in `public/icons/`
- Update `manifest.webmanifest` to reference the icon files

5. Build the app:
```bash
npm run build
```

6. Deploy to Firebase:
```bash
firebase deploy --only hosting
firebase deploy --only functions
```

## Usage

1. Open the app in Chrome or Edge (for best speech recognition support)
2. Select a source language or leave on "Auto-detect"
3. Click "Start Listening" to begin speech recognition
4. Speak in any supported language
5. The app will detect the language, translate to English, and speak the translation

## Development

### Running Locally (No Deployment Required!)

The app now includes a **mock translation service** for development that works without Firebase Functions or Google Cloud Translation API. This means you can test the app locally with zero errors!

**To run in development mode:**

1. Start the Angular dev server:
```bash
npm start
```

2. The app will automatically use mock translation service (no errors!)

**Optional: Use Firebase Emulators (for testing real functions)**

If you want to test with actual Firebase Functions locally:

1. Install Firebase tools (if not already installed):
```bash
npm install -g firebase-tools
```

2. Start the emulators in a separate terminal:
```bash
.\start-emulators.ps1
```
Or manually:
```bash
cd functions
npm run build
cd ..
firebase emulators:start --only functions
```

3. The app will automatically connect to the local emulator at `http://localhost:5001`

**To switch between mock and real functions:**

Edit `src/environments/environment.ts`:
- `useMockTranslation: true` - Uses mock service (no API needed, no errors!)
- `useMockTranslation: false` - Uses Firebase Functions (requires emulator or deployment)

Build for production:
```bash
npm run build
```

## Project Structure

- `src/app/services/` - Core services (speech recognition, translation, text-to-speech, storage)
- `src/app/translator/` - Main translator component
- `functions/` - Firebase Cloud Functions for Translation API proxy
- `public/` - Static assets and PWA manifest

## Firebase Configuration

- **Project ID**: translate-to-english-80cad
- **Project Number**: 787907356274
- **Hosting**: Firebase Hosting
- **Functions**: Firebase Cloud Functions (Node.js 20)

## API Usage

The app uses Google Cloud Translation API free tier (500K characters/month).

## Browser Support

- **Speech Recognition**: Chrome, Edge (best support), Safari (limited)
- **Text-to-Speech**: All modern browsers
- **PWA**: All modern browsers
