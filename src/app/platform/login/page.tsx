"use client";

/**
 * Platform Super Admin Login Page
 * 
 * Dedicated login page for platform administrators.
 * Signs in with Firebase Email/Password, then verifies via /api/platform/me.
 * 
 * Route: /platform/login
 * Redirects to: /platform/clients on success
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebase } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, AlertCircle } from "lucide-react";

function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  
  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Check if already logged in as platform admin
  useEffect(() => {
    if (!mounted) return;
    
    const checkAuth = async () => {
      try {
        const auth = getFirebase().auth;
        const user = auth.currentUser;
        
        if (user) {
          const token = await user.getIdToken();
          const response = await fetch("/api/platform/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          const data = await response.json();
          if (data.isPlatformAdmin) {
            router.push("/platform/clients");
          }
        }
      } catch (err) {
        // Not a platform admin or Firebase not initialized, stay on login page
        console.error("Auth check error:", err);
      }
    };
    
    checkAuth();
  }, [router, mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    console.log("🔐 Login attempt started", { email });
    
    if (!email || !password) {
      setError("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      console.log("📧 Signing in with Firebase Auth...");
      const auth = getFirebase().auth;
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("✅ Firebase Auth successful", { uid: user.uid, email: user.email });
      
      // Get ID token
      const token = await user.getIdToken();
      console.log("🎫 Got ID token, verifying platform admin...");
      
      // Verify platform admin status via server
      const response = await fetch("/api/platform/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      // Log details for debugging
      console.log("📋 Platform admin check result:", {
        uid: user.uid,
        email: user.email,
        isPlatformAdmin: data.isPlatformAdmin,
        error: data.error,
        responseStatus: response.status
      });
      
      if (data.isPlatformAdmin) {
        // Success: redirect to platform clients
        console.log("✨ Success! Redirecting to /platform/clients");
        // Use window.location for full page reload to ensure auth state is fresh
        window.location.href = "/platform/clients";
      } else {
        // Not a platform admin: sign out
        console.log("❌ Not a platform admin, signing out");
        await signOut(auth);
        setError(`غير مصرح: ${data.error || "أنت لست مسؤول منصة"}`);
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      
      // Sign out on any error
      try {
        await signOut(getFirebase().auth);
      } catch {
        // Ignore sign out errors
      }
      
      if (err instanceof Error) {
        if (err.message.includes("auth/invalid-credential") || err.message.includes("auth/wrong-password")) {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        } else if (err.message.includes("auth/user-not-found")) {
          setError("لم يتم العثور على المستخدم");
        } else if (err.message.includes("auth/too-many-requests")) {
          setError("محاولات تسجيل دخول كثيرة. الرجاء المحاولة لاحقاً");
        } else {
          setError(err.message || "فشل تسجيل الدخول");
        }
      } else {
        setError("فشل تسجيل الدخول. الرجاء المحاولة مرة أخرى");
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't render until mounted to avoid SSR issues
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center mb-2">
            <div className="rounded-full bg-indigo-100 p-3">
              <Shield className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Platform Super Admin</CardTitle>
          <CardDescription className="text-center">
            تسجيل دخول مسؤول المنصة
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {searchParams?.get("message") && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{searchParams.get("message")}</AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => router.push("/login")}
              className="text-sm text-muted-foreground"
            >
              العودة إلى تسجيل الدخول العادي
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    }>
      <PlatformLoginForm />
    </Suspense>
  );
}
