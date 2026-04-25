// Firebase is used ONLY for real-time sensor data (GPS, crash events).
// Authentication is handled by the MongoDB/Express backend.
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAk3s2yP59W4oHOyHZe94oLWlFOJZxaXp8",
  authDomain: "smarthelmet-961f1.firebaseapp.com",
  databaseURL: "https://smarthelmet-961f1-default-rtdb.firebaseio.com",
  projectId: "smarthelmet-961f1",
  storageBucket: "smarthelmet-961f1.firebasestorage.app",
  messagingSenderId: "894692819687",
  appId: "1:894692819687:web:47943487254f3054ef5842"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
