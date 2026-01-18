// Firebase Configuration
// Credentials for poss-2b64e project

const firebaseConfig = {
    apiKey: "AIzaSyCF7THBYo69IzeuCGxdBB88bt_x_wx6-r0",
    authDomain: "poss-2b64e.firebaseapp.com",
    databaseURL: "https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "poss-2b64e",
    storageBucket: "poss-2b64e.firebasestorage.app",
    messagingSenderId: "938632996173",
    appId: "1:938632996173:web:43b6243a2449f54052c304",
    measurementId: "G-QLSYR4WZLP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Export database reference for use in app.js
window.firebaseDB = database;
