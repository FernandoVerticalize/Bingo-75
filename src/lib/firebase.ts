import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import firebaseConfigJSON from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: "gen-lang-client-0088393754",
  appId: "1:1058196238206:web:0c9f41071e9a9a54fe8d2f",
  apiKey: "AIzaSyD9fqYhx4CHg_ejVdyaIUpt4BUXerN5AlY",
  authDomain: "gen-lang-client-0088393754.firebaseapp.com",
  storageBucket: "gen-lang-client-0088393754.firebasestorage.app",
  messagingSenderId: "1058196238206",
};

export const app = initializeApp(firebaseConfigJSON);
export const db = getFirestore(app, firebaseConfigJSON.firestoreDatabaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);
