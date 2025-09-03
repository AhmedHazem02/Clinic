"use server";

import { authAdmin } from "@/lib/firebaseAdmin";

// Generic function to create a user with a specific role
export const createUser = async (email: string, password: string, role: 'doctor' | 'nurse') => {
    try {
        const userRecord = await authAdmin().createUser({
            email,
            password,
            displayName: role.charAt(0).toUpperCase() + role.slice(1), // Capitalize role for display name
        });
        // We set a custom claim to identify the role
        await authAdmin().setCustomUserClaims(userRecord.uid, { role });
        return userRecord;
    } catch (error: any) {
         if (error.code === 'auth/email-already-exists') {
            throw new Error('The email address is already in use by another account.');
        } else if (error.code === 'auth/invalid-password') {
            throw new Error('Password should be at least 6 characters.');
        } else {
            console.error("Firebase Admin Error:", error.message);
            throw new Error(error.message || 'Failed to create user.');
        }
    }
}
