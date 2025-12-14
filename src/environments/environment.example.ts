// Copy this file to environment.ts and environment.prod.ts
// Update with your Firebase project credentials

export const environment = {
  production: false, // Set to true for environment.prod.ts
  firebase: {
    projectId: 'translate-to-english-80cad',
    appId: 'YOUR_APP_ID', // Get from Firebase Console
    storageBucket: 'translate-to-english-80cad.firebasestorage.app',
    apiKey: 'YOUR_API_KEY', // Get from Firebase Console
    authDomain: 'translate-to-english-80cad.firebaseapp.com',
    messagingSenderId: '787907356274',
  },
  functionsUrl: 'https://us-central1-translate-to-english-80cad.cloudfunctions.net'
};

