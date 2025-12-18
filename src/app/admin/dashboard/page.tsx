"use client";

/**
 * Admin Dashboard (Clinic Owner)
 *
 * Placeholder page for clinic owner/admin dashboard.
 * Full implementation will include staff management, clinic settings, and statistics.
 *
 * Step 2: Basic placeholder with role verification
 * Step 3+: Full feature implementation
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Settings, ArrowLeft, UserPlus, BarChart3 } from "lucide-react";
import { onAuthChange } from "@/services/authClientService";
import { getUserProfileWithLegacyFallback, isModernProfile } from "@/services/userProfileService";
import type { UserProfile } from "@/types/multitenant";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const profile = await getUserProfileWithLegacyFallback(user.uid);

        if (!profile) {
          setError('Profile not found');
          router.push('/login');
          return;
        }

        // Check if user is owner (only owners can access admin dashboard)
        if (!isModernProfile(profile) || profile.role !== 'owner') {
          setError('Access denied: Only clinic owners can access this page');
          // Redirect to appropriate dashboard based on role
          if (isModernProfile(profile)) {
            if (profile.role === 'doctor') {
              router.push('/doctor/dashboard');
            } else if (profile.role === 'nurse') {
              router.push('/nurse/dashboard');
            }
          }
          return;
        }

        setUserProfile(profile);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile');
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">خطأ في الوصول</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/login')} variant="outline">
              العودة إلى تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة تحكم المدير</h1>
          <p className="text-muted-foreground">
            مرحباً، {userProfile.displayName}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/login')}>
          <ArrowLeft className="ml-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>

      {/* User Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            معلومات الحساب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">الاسم</p>
              <p className="font-medium">{userProfile.displayName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
              <p className="font-medium">{userProfile.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الدور</p>
              <p className="font-medium">مالك العيادة</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">معرف العيادة</p>
              <p className="font-mono text-sm">{userProfile.clinicId}</p>
            </div>
            {userProfile.doctorId && (
              <div>
                <p className="text-sm text-muted-foreground">معرف الطبيب</p>
                <p className="font-mono text-sm">{userProfile.doctorId}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">الحالة</p>
              <p className="font-medium">
                {userProfile.isActive ? (
                  <span className="text-green-600">نشط</span>
                ) : (
                  <span className="text-red-600">غير نشط</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/staff')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              إدارة الموظفين
            </CardTitle>
            <CardDescription>
              عرض وإدارة الأطباء والممرضين في العيادة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" className="w-full">
              عرض الموظفين
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/invites')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              دعوة الموظفين
            </CardTitle>
            <CardDescription>
              إنشاء دعوات للأطباء والممرضين الجدد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" className="w-full">
              إدارة الدعوات
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              إعدادات العيادة
            </CardTitle>
            <CardDescription>
              تحرير معلومات العيادة والأسعار
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              إدارة الاسم، جهات الاتصال، أوقات الاستشارة، والأسعار
            </p>
            <Link href="/admin/settings">
              <Button variant="outline" className="w-full">
                إعدادات العيادة
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              الإحصائيات
            </CardTitle>
            <CardDescription>
              إحصائيات العيادة والإيرادات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              قريباً: إجمالي المرضى، الإيرادات، إحصائيات الأطباء
            </p>
            <Button disabled variant="outline" className="w-full">
              عرض الإحصائيات
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Temporary Access to Doctor Dashboard */}
      {userProfile.doctorId && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>الوصول السريع</CardTitle>
            <CardDescription>
              بصفتك مالك العيادة والطبيب الرئيسي، يمكنك الوصول إلى لوحة تحكم الطبيب
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/doctor/dashboard')} className="w-full">
              انتقل إلى لوحة تحكم الطبيب
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
