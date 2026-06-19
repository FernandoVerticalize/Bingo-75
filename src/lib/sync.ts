import { auth, db, storage } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { MasterCard, BingoRound } from '../types';

export const initAuth = async () => {
    try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
    } catch (e: any) {
        if (e?.code === 'auth/admin-restricted-operation') {
            console.warn("Please enable Anonymous Authentication in the Firebase Console to sync data.");
        } else {
            console.warn("Offline or auth failed");
        }
    }
};

export const syncCardToFirestore = async (card: MasterCard) => {
    if (!auth.currentUser) return;
    try {
        const docRef = doc(db, 'users', auth.currentUser.uid, 'cards', card.id);
        await setDoc(docRef, card, { merge: true });
    } catch (e) {
        console.error("Failed to sync card to Firestore:", e);
    }
};

export const uploadCardImage = async (cardId: string, base64Image: string): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
        // Upload base64 image (data:image/jpeg;base64,....)
        const storageRef = ref(storage, `users/${auth.currentUser.uid}/cards/${cardId}.jpeg`);
        await uploadString(storageRef, base64Image, 'data_url');
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (e) {
        console.error("Failed to upload image:", e);
        return null;
    }
};

export const syncRoundToFirestore = async (round: BingoRound) => {
    if (!auth.currentUser) return;
    try {
       const docRef = doc(db, 'users', auth.currentUser.uid, 'rounds', round.id);
       await setDoc(docRef, round, { merge: true });
    } catch (e) {
       console.error("Failed to sync round to Firestore:", e);
    }
}
