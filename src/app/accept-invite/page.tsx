"use client";

/**
 * Accept Invite Page
 *
 * Allows staff (doctors/nurses) to accept clinic invitations.
 * Handles token verification, authentication, and profile creation.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, UserPlus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { onAuthChange, signUpUser, signInUser } from "@/services/authClientService";
import { createUserProfile, getUserProfileWithLegacyFallback } from "@/services/userProfileService";
import { createDoctorDocument, createNurseDocument } from "@/services/queueService";
import { getClinic } from "@/services/clinicService";
import { verifyInviteToken, acceptInvite, type Invite } from "@/services/inviteService";
import type { Clinic } from "@/types/multitenant";

const signupSchema = z.object({
  name: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل"),
  email: z.string().email("يجب إدخال عنوان بريد إلكتروني صالح"),
  password: z.string().min(6, "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"),
  confirmPassword: z.string(),
  specialty: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

type PageState =
  | 'loading'
  | 'invalid_token'
  | 'expired_token'
  | 'auth_required'
  | 'email_mismatch'
  | 'processing'
  | 'success'
  | 'error';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      specialty: "",
    },
  });

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setPageState('invalid_token');
      return;
    }

    initializePage(token);
  }, [searchParams]);

  const initializePage = async (token: string) => {
    try {
      // Verify token
      const verifiedInvite = await verifyInviteToken(token);
      if (!verifiedInvite) {
        setPageState('invalid_token');
        return;
      }

      setInvite(verifiedInvite);

      // Get clinic information
      const clinicData = await getClinic(verifiedInvite.clinicId);
      if (!clinicData) {
        setPageState('error');
        return;
      }
      setClinic(clinicData);

      // Pre-fill email in form
      form.setValue('email', verifiedInvite.email);

      // Check if user is already authenticated
      const unsubscribe = onAuthChange(async (user) => {
        if (!user) {
          setPageState('auth_required');
          return;
        }

        setCurrentUserEmail(user.email || '');

        // Check if email matches
        if (user.email?.toLowerCase() !== verifiedInvite.email.toLowerCase()) {
          setPageState('email_mismatch');
          return;
        }

        // Check if user already has a profile
        const existingProfile = await getUserProfileWithLegacyFallback(user.uid);
        if (existingProfile && 'clinicId' in existingProfile) {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: "لديك حساب بالفعل في عيادة أخرى",
          });
          setPageState('error');
          return;
        }

        // Auto-accept if authenticated with correct email
        await handleAcceptInvite(user.uid, verifiedInvite, clinicData);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error initializing page:', error);
      setPageState('error');
    }
  };

  const handleAcceptInvite = async (uid: string, inviteData: Invite, clinicData: Clinic) => {
    setPageState('processing');

    try {
      let staffDocumentId: string;
      const userName = form.watch('name') || inviteData.email.split('@')[0];

      // Create doctor or nurse document based on role
      if (inviteData.role === 'doctor') {
        staffDocumentId = await createDoctorDocument({
          uid,
          clinicId: clinicData.id!,
          name: userName,
          email: inviteData.email,
          specialty: form.watch('specialty') || '',
        });
      } else {
        staffDocumentId = await createNurseDocument({
          uid,
          clinicId: clinicData.id!,
          name: userName,
          email: inviteData.email,
        });
      }

      // Create user profile
      const userProfileData: any = {
        email: inviteData.email,
        displayName: userName,
        clinicId: clinicData.id!,
        role: inviteData.role,
        invitedBy: inviteData.createdByUid,
      };
      
      // Add role-specific fields (avoid undefined)
      if (inviteData.role === 'doctor') {
        userProfileData.doctorId = staffDocumentId;
      } else {
        userProfileData.nurseId = staffDocumentId;
      }
      
      await createUserProfile(uid, userProfileData);

      // Mark invite as accepted
      await acceptInvite(inviteData.id!, clinicData.id!, uid);

      setPageState('success');

      // Redirect to appropriate dashboard after 2 seconds
      setTimeout(() => {
        if (inviteData.role === 'doctor') {
          router.push('/doctor/dashboard');
        } else {
          router.push('/nurse/dashboard');
        }
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast({
        variant: "destructive",
        title: "فشل قبول الدعوة",
        description: error.message || "حدث خطأ غير متوقع",
      });
      setPageState('error');
    }
  };

  const onSignup = async (values: SignupFormValues) => {
    if (!invite || !clinic) return;

    setIsSubmitting(true);

    try {
      // Create Firebase Auth account
      const userCredential = await signUpUser(values.email, values.password);
      const uid = userCredential.user.uid;

      // Accept the invite (creates staff document and profile)
      await handleAcceptInvite(uid, invite, clinic);
    } catch (error: any) {
      console.error('Signup error:', error);

      // If email already exists, suggest login
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: "destructive",
          title: "البريد الإلكتروني مستخدم بالفعل",
          description: "إذا كان لديك حساب بالفعل، قم بتسجيل الدخول بدلاً من ذلك",
        });
        setShowLoginForm(true);
      } else {
        toast({
          variant: "destructive",
          title: "فشل إنشاء الحساب",
          description: error.message || "حدث خطأ غير متوقع",
        });
      }
      setIsSubmitting(false);
    }
  };

  const onLogin = async () => {
    if (!invite || !clinic) return;

    const email = form.watch('email');
    const password = form.watch('password');

    setIsSubmitting(true);

    try {
      const userCredential = await signInUser(email, password);
      const uid = userCredential.user.uid;

      // Verify email matches
      if (userCredential.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "عنوان البريد الإلكتروني لا يتطابق مع الدعوة",
        });
        setIsSubmitting(false);
        return;
      }

      await handleAcceptInvite(uid, invite, clinic);
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: "تحقق من البريد الإلكتروني وكلمة المرور",
      });
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">جاري التحقق من الدعوة...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (pageState === 'invalid_token' || pageState === 'expired_token') {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              دعوة غير صالحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {pageState === 'expired_token'
                ? "انتهت صلاحية رابط الدعوة. اطلب دعوة جديدة من مالك العيادة."
                : "رابط الدعوة غير صالح، تم إلغاؤه، أو تم استخدامه بالفعل. يرجى التواصل مع مالك العيادة للحصول على دعوة جديدة."}
            </p>
            <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
              الذهاب إلى تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email mismatch
  if (pageState === 'email_mismatch') {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-700">عدم تطابق البريد الإلكتروني</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              أنت مسجل دخول حالياً باستخدام <strong>{currentUserEmail}</strong>، ولكن هذه الدعوة موجهة إلى{' '}
              <strong>{invite?.email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              يرجى تسجيل الخروج وتسجيل الدخول بالبريد الإلكتروني الصحيح.
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              تسجيل الخروج والمحاولة مرة أخرى
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing state
  if (pageState === 'processing') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">جاري قبول الدعوة...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-6 w-6" />
              تم قبول الدعوة بنجاح!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              مرحباً بك في {clinic?.name}! جاري توجيهك إلى لوحة التحكم...
            </p>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="flex h-screen items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">حدث خطأ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              فشل قبول الدعوة. يرجى المحاولة مرة أخرى أو الاتصال بمالك العيادة.
            </p>
            <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
              الذهاب إلى تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auth required - Show signup/login form
  return (
    <div className="container mx-auto p-6 min-h-screen flex items-center justify-center" dir="rtl">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">مرحباً بك!</h1>
          <p className="text-muted-foreground">
            تمت دعوتك للانضمام إلى <strong>{clinic?.name}</strong> كـ{' '}
            {invite?.role === 'doctor' ? 'طبيب' : 'ممرض'}
          </p>
        </div>

        {/* Clinic Info */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">{clinic?.name}</h3>
                <p className="text-sm text-blue-700">
                  الدور: {invite?.role === 'doctor' ? 'طبيب' : 'ممرض'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signup/Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {showLoginForm ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </CardTitle>
            <CardDescription>
              {showLoginForm
                ? 'قم بتسجيل الدخول لقبول الدعوة'
                : 'أنشئ حساباً جديداً للانضمام إلى العيادة'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(showLoginForm ? onLogin : onSignup)}
              className="space-y-4"
            >
              {/* Email (pre-filled, disabled) */}
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني *</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  disabled
                  dir="ltr"
                  className="bg-gray-100"
                />
              </div>

              {/* Name (signup only) */}
              {!showLoginForm && (
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل *</Label>
                  <Input
                    id="name"
                    placeholder="د. أحمد محمد"
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
              )}

              {/* Specialty (doctors only, signup only) */}
              {!showLoginForm && invite?.role === 'doctor' && (
                <div className="space-y-2">
                  <Label htmlFor="specialty">التخصص (اختياري)</Label>
                  <Input
                    id="specialty"
                    placeholder="طب عام، جراحة، ..."
                    {...form.register('specialty')}
                  />
                </div>
              )}

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور *</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password (signup only) */}
              {!showLoginForm && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...form.register('confirmPassword')}
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري المعالجة...
                  </>
                ) : showLoginForm ? (
                  'تسجيل الدخول وقبول الدعوة'
                ) : (
                  'إنشاء الحساب وقبول الدعوة'
                )}
              </Button>

              {/* Toggle Login/Signup */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowLoginForm(!showLoginForm)}
                  className="text-sm"
                >
                  {showLoginForm ? 'ليس لديك حساب? إنشاء حساب جديد' : 'لديك حساب بالفعل? تسجيل الدخول'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <Alert>
          <AlertDescription className="text-sm">
            بقبول هذه الدعوة، ستنضم إلى <strong>{clinic?.name}</strong> وستتمكن من الوصول إلى نظام
            إدارة قائمة الانتظار وبيانات المرضى.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">جاري التحميل...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
