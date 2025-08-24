"use client";

import { auth } from "@/lib/firebase";
import { 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    type User
} from "firebase/auth";

export const signInUser = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
}

export const signOutUser = () => {
    return signOut(auth);
}

export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
}

export type { User };
