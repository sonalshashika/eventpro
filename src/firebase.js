import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push, child, remove } from "firebase/database";

// Firebase configuration using environment variables for safety
// In a real project, you would store these in a .env file
const firebaseConfig = {
    apiKey: "AIzaSyBViUyD7Sj25Cr9NU7j4FSTCWADdmn_RIw",
    authDomain: "events-tabal.firebaseapp.com",
    projectId: "events-tabal",
    storageBucket: "events-tabal.firebasestorage.app",
    messagingSenderId: "4784023188",
    appId: "1:4784023188:web:430c8ff5c474cd35cab681",
    databaseURL: "https://events-tabal-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set, push, child, remove };
