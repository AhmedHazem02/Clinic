"use client";

/**
 * Clinic Onboarding Page
 *
 * Updates clinic details created by Platform Admin.
 * Owner just needs to complete clinic name, slug, and personal info.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { onAuthChange } from "@/services/authClientService";
import { getUserProfileWithLegacyFallback } from "@/services/userProfileService";
import { getFirebase } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

const onboardingSchema = z.object({
  clinicName: z.string().min(3, "يجب أن يتكون اسم العيادة من 3 أحرف على الأقل"),
  clinicSlug: z
    .string()
    .min(3, "يجب أن يتكون المعرف من 3 أحرف على الأقل")
    .max(50, "المعرف طويل جدًا")
    .regex(/^[a-z0-9-]+$/, "يجب أن يحتوي المعرف على أحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
  doctorName: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل"),
  specialty: z.string().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function ClinicOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      clinicName: "",
      clinicSlug: "",
      doctorName: "",
      specialty: "",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user already has a profile
      const profile = await getUserProfileWithLegacyFallback(user.uid);

      if (profile && 'clinicId' in profile) {
        const db = getFirebase().db;

        // Check if clinic already has proper name (not default email-based)
        const clinicRef = doc(db, 'clinics', profile.clinicId);
        const clinicSnap = await getDoc(clinicRef);
        
        if (clinicSnap.exists()) {
          const clinicData = clinicSnap.data();
          const doctorRef = doc(db, 'doctors', user.uid);
          const doctorSnap = await getDoc(doctorRef);
          
          // If clinic name is still email-based, allow onboarding
          // Otherwise redirect to dashboard (onboarding already completed)
          if (clinicData.name && !clinicData.name.includes('@')) {
            // Onboarding completed - redirect to dashboard
            if (profile.role === 'owner') {
              router.push('/admin/dashboard');
            } else if (profile.role === 'doctor') {
              router.push('/doctor/dashboard');
            } else {
              router.push('/nurse/dashboard');
            }
            return;
          }

          // Pre-fill form with existing data
          if (doctorSnap.exists()) {
            const doctorData = doctorSnap.data();
            form.setValue('doctorName', doctorData.name || '');
            form.setValue('specialty', doctorData.specialty || '');
          }
          form.setValue('clinicName', clinicData.name || '');
          form.setValue('clinicSlug', clinicData.slug || '');
        }
      }

      setUserEmail(user.email || "");
      setUserId(user.uid);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Auto-generate slug from clinic name
  const handleClinicNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('clinicName', name);

    // Auto-generate slug (only if user hasn't manually edited it)
    if (!form.formState.dirtyFields.clinicSlug) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      form.setValue('clinicSlug', slug);
    }
  };

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يجب تسجيل الدخول أولاً",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getFirebase().db;

      // Get existing user profile to find clinicId
      const userProfileRef = doc(db, 'userProfiles', userId);
      const userProfileSnap = await getDoc(userProfileRef);

      if (!userProfileSnap.exists()) {
        throw new Error('لم يتم العثور على ملف المستخدم. يرجى التواصل مع الدعم.');
      }

      const userProfile = userProfileSnap.data();
      const clinicId = userProfile.clinicId;

      if (!clinicId) {
        throw new Error('لم يتم العثور على معرف العيادة. يرجى التواصل مع الدعم.');
      }

      // Check if new slug is different and available
      const currentClinicSnap = await getDoc(doc(db, 'clinics', clinicId));
      const currentSlug = currentClinicSnap.data()?.slug;
      
      if (values.clinicSlug !== currentSlug) {
        // Check if new slug is already taken
        // Note: This is a simple check, not comprehensive for concurrency
        const clinicsRef = doc(db, 'clinics', clinicId);
        // For now, we'll just update it. Proper validation would need server-side checking
      }

      // 1. Update clinic with proper name and slug
      const clinicRef = doc(db, 'clinics', clinicId);
      await updateDoc(clinicRef, {
        name: values.clinicName,
        slug: values.clinicSlug,
        ownerName: values.doctorName,
        updatedAt: new Date(),
      });

      // 2. Update doctor document with proper name and specialty
      const doctorRef = doc(db, 'doctors', userId);
      await updateDoc(doctorRef, {
        name: values.doctorName,
        specialty: values.specialty || 'عام',
        updatedAt: new Date(),
      });

      // 3. Update user profile with display name
      await updateDoc(userProfileRef, {
        displayName: values.doctorName,
        updatedAt: new Date(),
      });

      toast({
        title: "تم تحديث العيادة بنجاح!",
        description: `مرحباً بك في ${values.clinicName}`,
      });

      // Redirect to admin dashboard
      router.push('/admin/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        variant: "destructive",
        title: "فشل تحديث العيادة",
        description: error.message || "حدث خطأ غير متوقع",
      });
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="container mx-auto p-6 min-h-screen flex items-center justify-center" dir="rtl">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">إكمال إعداد العيادة</h1>
          <p className="text-muted-foreground">
            أكمل معلومات عيادتك وبياناتك الشخصية
          </p>
        </div>

        {/* Onboarding Form */}
        <Card>
          <CardHeader>
            <CardTitle>معلومات العيادة</CardTitle>
            <CardDescription>
              املأ التفاصيل الأساسية لعيادتك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Clinic Name */}
              <div className="space-y-2">
                <Label htmlFor="clinicName">اسم العيادة *</Label>
                <Input
                  id="clinicName"
                  placeholder="عيادة د. أحمد"
                  {...form.register('clinicName')}
                  onChange={handleClinicNameChange}
                />
                {form.formState.errors.clinicName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clinicName.message}
                  </p>
                )}
              </div>

              {/* Clinic Slug */}
              <div className="space-y-2">
                <Label htmlFor="clinicSlug">معرف العيادة (للروابط) *</Label>
                <Input
                  id="clinicSlug"
                  placeholder="dr-ahmed-clinic"
                  {...form.register('clinicSlug')}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  سيتم استخدام هذا المعرف في روابط العيادة (مثل: queuewise.com/dr-ahmed-clinic)
                </p>
                {form.formState.errors.clinicSlug && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clinicSlug.message}
                  </p>
                )}
              </div>

              {/* Doctor Name */}
              <div className="space-y-2">
                <Label htmlFor="doctorName">اسمك (كطبيب) *</Label>
                <Input
                  id="doctorName"
                  placeholder="د. أحمد محمد"
                  {...form.register('doctorName')}
                />
                {form.formState.errors.doctorName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.doctorName.message}
                  </p>
                )}
              </div>

              {/* Specialty */}
              <div className="space-y-2">
                <Label htmlFor="specialty">التخصص (اختياري)</Label>
                <Input
                  id="specialty"
                  placeholder="طب عام، جراحة، ..."
                  {...form.register('specialty')}
                />
                {form.formState.errors.specialty && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.specialty.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  "جاري الحفظ..."
                ) : (
                  <>
                    حفظ والمتابعة
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-800">
              <strong>ملاحظة:</strong> بعد إنشاء العيادة، ستتمكن من دعوة أطباء وممرضين آخرين للانضمام إلى فريقك.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
