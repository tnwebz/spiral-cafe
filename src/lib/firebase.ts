// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDoezsUeghiWjL6F2dtyEM18AxjkPnmLHk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "spiral-cafe.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "spiral-cafe",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "spiral-cafe.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "588144460957",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:588144460957:web:da89ed6d9e8c2240a50074"
};

// Initialize Firebase defensively for SSR and Client
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firestore = typeof window !== "undefined" ? getFirestore(firebaseApp) : null;
