# Translate to English (Angular PWA)

A Progressive Web App that listens to speech, translates **from a selected source language to English**, and can speak the translation out loud.

## Features

- **Speech recognition**: Uses the Web Speech API (best in Chrome/Edge)
- **Real-time-ish translation**: Translates finalized speech in chunks (reduces API calls)
- **Text-to-speech**: Optional “Read aloud” for the English output
- **Language selection**: 30+ languages, including Southeast Asian languages
- **PWA**: Installable; app shell is cached by the service worker
- **Local storage**: Saves your preferences and a small translation cache/history

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
- (Optional) Firebase CLI (`npm i -g firebase-tools`) if you want to use emulators or deploy
- (Optional) Google Cloud Translation API enabled in your Firebase project if using real Functions translation

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

3. (Optional) Enable Google Cloud Translation API

If you’re deploying and using the real Functions-backed translation:

- Enable **Cloud Translation API** in Google Cloud Console for your Firebase project.

4. Generate PWA icons (optional):
- The app uses `favicon.ico` as a fallback icon
- For production, create proper icon files (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512, 180x180) and place them in `public/icons/`
- Update `manifest.webmanifest` to reference the icon files

5. Build the app:
```bash
npm run build
```

6. (Optional) Deploy to Firebase:
```bash
firebase deploy --only hosting
firebase deploy --only functions
```

## Usage

1. Open the app in Chrome or Edge (for best speech recognition support)
2. Select a **source language**
3. Click **Start Listening** (or it may auto-start once you select a language)
4. Speak in any supported language
5. The app will translate to English, and optionally speak the translation if enabled

## Development

### Running Locally (No Deployment Required)

The app includes a **mock translation mode** for development, so you can run locally without deploying Functions.

**To run in development mode:**

1. Start the Angular dev server:
```bash
npm start
```

2. Ensure `src/environments/environment.ts` has:

- `useMockTranslation: true`

Then refresh the page.

### Optional: Use Firebase Emulators (test real Functions locally)

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

3. Configure `src/environments/environment.ts` for emulators:

- `useEmulator: true`
- `functionsUrl: 'http://localhost:5001/<your-project-id>/us-central1'`

### Switching between mock/emulator/production

Edit `src/environments/environment.ts`:
- `useMockTranslation: true` - Uses mock translation (best for quick local dev)
- `useMockTranslation: false` - Uses Firebase Functions (requires emulator or deployed Functions)
- `useEmulator: true|false` - When not mocking, choose emulator vs deployed Functions

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

- **Hosting**: Firebase Hosting
- **Functions**: Firebase Cloud Functions (Node.js 20)

## API Usage

If you use the real Functions translation, it uses Google Cloud Translation API (see your project’s quotas/billing).

## Deployment (Functions) Troubleshooting

If you see **404**, **CORS**, or **Status 0** errors in the browser console, it usually means the Functions endpoint isn’t reachable (not deployed, wrong URL, or emulator not running).

### Deploy Functions

From the repo root:

```bash
npm install
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Emulator not running

If you’re using the emulator URL and see connection errors, start it:

```bash
firebase emulators:start --only functions
```

## Browser Support

- **Speech Recognition**: Chrome, Edge (best support), Safari (limited)
- **Text-to-Speech**: All modern browsers
- **PWA**: All modern browsers
