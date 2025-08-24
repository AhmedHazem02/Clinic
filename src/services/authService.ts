"use server";

import { authAdmin } from "@/lib/firebaseAdmin";

// Admin action to create a nurse user
export const createNurseUser = async (email: string, password: string) => {
    try {
        const userRecord = await authAdmin.createUser({
            email,
            password,
            displayName: "Nurse", // Or derive from form
        });
        // We can set a custom claim to identify the role
        await authAdmin.setCustomUserClaims(userRecord.uid, { role: 'nurse' });
        return userRecord;
    } catch (error: any) {
         if (error.code === 'auth/email-already-exists') {
            throw new Error('The email address is already in use by another account.');
        } else if (error.code === 'auth/invalid-password') {
            throw new Error('Password should be at least 6 characters.');
        } else {
            throw new Error('Failed to create user.');
        }
    }
}
