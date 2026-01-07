"use client";

import { getFirebase } from "@/lib/firebase";
import { 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    type User
} from "firebase/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/sessionCookie";

/**
 * Sign in user with email and password
 * Sets session cookie for middleware auth checks
 */
export const signInUser = async (email: string, password: string) => {
    const { auth } = getFirebase();
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Set session cookie for middleware
    if (result.user) {
        setSessionCookie(result.user.uid);
    }
    
    return result;
}

/**
 * Sign out user
 * Clears session cookie before signing out
 */
export const signOutUser = async () => {
    const { auth } = getFirebase();
    
    // Clear session cookie first
    clearSessionCookie();
    
    return signOut(auth);
}

/**
 * Listen to auth state changes
 * Updates session cookie accordingly
 */
export const onAuthChange = (callback: (user: User | null) => void) => {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (user) => {
        // Update session cookie based on auth state
        if (user) {
            setSessionCookie(user.uid);
        } else {
            clearSessionCookie();
        }
        callback(user);
    });
}

export const sendPasswordReset = (email: string) => {
    const { auth } = getFirebase();
    return sendPasswordResetEmail(auth, email);
}

export const signUpUser = async (email: string, password: string) => {
    const { auth } = getFirebase();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Set session cookie for middleware
    if (result.user) {
        setSessionCookie(result.user.uid);
    }
    
    return result;
}

export type { User };
