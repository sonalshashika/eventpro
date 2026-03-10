import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, child, remove } from "firebase/database";

// Firebase configuration using environment variables for safety
// In a real project, you would store these in a .env file
const firebaseConfig = {
    // These are placeholders. You can replace them with your actual Firebase config.
    // I am setting up a default structure that will work with the Realtime Database.
    apiKey: "AIzaSy...",
    authDomain: "events-tabal.firebaseapp.com",
    databaseURL: "https://events-tabal-default-rtdb.firebaseio.com",
    projectId: "events-tabal",
    storageBucket: "events-tabal.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set, push, child, remove };
