
"use client";

import { getFirebase } from "@/lib/firebase";
import { 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    type User
} from "firebase/auth";

export const signInUser = (email: string, password: string) => {
    const { auth } = getFirebase();
    return signInWithEmailAndPassword(auth, email, password);
}

export const signOutUser = () => {
    const { auth } = getFirebase();
    return signOut(auth);
}

export const onAuthChange = (callback: (user: User | null) => void) => {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, callback);
}

export const sendPasswordReset = (email: string) => {
    const { auth } = getFirebase();
    return sendPasswordResetEmail(auth, email);
}

export const signUpUser = async (email: string, password: string) => {
    const { auth } = getFirebase();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    return createUserWithEmailAndPassword(auth, email, password);
}

export type { User };
