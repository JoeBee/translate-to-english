# Deployment Guide for Translate to English

## Current Issues

The errors you're seeing are because **Firebase Functions are not deployed yet**. The errors include:
- **404 Not Found**: Functions don't exist yet
- **CORS errors**: Can't send CORS headers if functions don't exist
- **Status 0 errors**: Browser blocking requests due to CORS

## Prerequisites

1. **Firebase CLI installed**: `npm install -g firebase-tools`
2. **Firebase project created**: `translate-to-english-80cad`
3. **Google Cloud Translation API enabled** in Google Cloud Console

## Step-by-Step Deployment

### 1. Install Function Dependencies

```bash
cd C:\JB\translate-to-english\functions
npm install
```

### 2. Build Functions

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` directory.

### 3. Enable Google Cloud Translation API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `translate-to-english-80cad`
3. Navigate to **APIs & Services** → **Library**
4. Search for "Cloud Translation API"
5. Click **Enable**

### 4. Set Up Authentication

The functions use Application Default Credentials. When deployed, Firebase automatically provides these.

For local testing (optional):
```bash
gcloud auth application-default login
```

### 5. Deploy Functions

From the project root:
```bash
cd C:\JB\translate-to-english
firebase deploy --only functions
```

This will deploy:
- `detectLanguage` → `https://us-central1-translate-to-english-80cad.cloudfunctions.net/detectLanguage`
- `translateText` → `https://us-central1-translate-to-english-80cad.cloudfunctions.net/translateText`

### 6. Verify Deployment

After deployment, check:
1. Functions appear in [Firebase Console](https://console.firebase.google.com/) → Functions
2. Test URLs respond (they should return JSON, not 404)
3. Check logs: `firebase functions:log`

## Troubleshooting

### Error: "Permission denied"
- Ensure you're logged in: `firebase login`
- Verify project: `firebase use translate-to-english-80cad`

### Error: "API not enabled"
- Enable Cloud Translation API in Google Cloud Console
- Wait a few minutes for activation

### Error: "Build failed"
- Check TypeScript errors: `cd functions && npm run build`
- Ensure Node.js version matches (requires Node 20)

### Error: "CORS still blocking after deployment"
- Functions must return CORS headers (already implemented)
- Verify functions are deployed correctly
- Check browser console for specific CORS errors

## Testing Locally (Optional)

You can test functions locally before deploying:

```bash
cd functions
npm run serve
```

This starts Firebase emulator. Update `environment.ts` to use:
```typescript
functionsUrl: 'http://localhost:5001/translate-to-english-80cad/us-central1'
```

## After Deployment

Once functions are deployed:
1. ✅ 404 errors will stop (functions exist)
2. ✅ CORS errors will stop (CORS headers are sent)
3. ✅ Translation will work (API calls succeed)

The app will automatically use the deployed functions - no code changes needed!

