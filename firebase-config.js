// Firebase Configuration
// Credentials loaded from .env file for security

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCF7THBYo69IzeuCGxdBB88bt_x_wx6-r0",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "poss-2b64e.firebaseapp.com",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: process.env.FIREBASE_PROJECT_ID || "poss-2b64e",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "poss-2b64e.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "938632996173",
    appId: process.env.FIREBASE_APP_ID || "1:938632996173:web:43b6243a2449f54052c304",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-QLSYR4WZLP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Export database reference for use in app.js
window.firebaseDB = database;
