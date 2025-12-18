"use client";

/**
 * Invitations Management Page (Admin/Owner Only)
 *
 * Create and manage staff invitations.
 * Generates secure token-based invite links for doctors and nurses.
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UserPlus, Copy, CheckCircle2, XCircle, Clock, Mail, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFirebase } from "@/lib/firebase";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { onAuthChange } from "@/services/authClientService";
import { getUserProfileWithLegacyFallback, isModernProfile } from "@/services/userProfileService";
import {
  createInvite,
  getClinicInvites,
  revokeInvite,
  type Invite,
  type InviteStatus
} from "@/services/inviteService";
import type { UserProfile } from "@/types/multitenant";
import { Timestamp } from "firebase/firestore";

const inviteSchema = z.object({
  email: z.string().email("يجب إدخال عنوان بريد إلكتروني صالح"),
  role: z.enum(["doctor", "nurse"], {
    required_error: "يجب اختيار الدور",
  }),
  expiryDays: z.string().optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function InvitesManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: undefined,
      expiryDays: "7",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const profile = await getUserProfileWithLegacyFallback(user.uid);

        if (!profile || !isModernProfile(profile) || profile.role !== 'owner') {
          toast({
            variant: "destructive",
            title: "خطأ في الوصول",
            description: "هذه الصفحة متاحة فقط لمالكي العيادات",
          });
          router.push('/login');
          return;
        }

        setUserProfile(profile);
        setIsLoading(false);

        // Load existing invites
        await loadInvites(profile.clinicId);
      } catch (err) {
        console.error('Error loading profile:', err);
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "فشل في تحميل البيانات",
        });
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  const loadInvites = async (clinicId: string) => {
    setIsLoadingInvites(true);
    try {
      const invitesData = await getClinicInvites(clinicId);
      // Sort by creation date (newest first)
      invitesData.sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      setInvites(invitesData);
    } catch (error) {
      console.error('Error loading invites:', error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل في تحميل الدعوات",
      });
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const onSubmit = async (values: InviteFormValues) => {
    if (!userProfile) return;

    setIsSubmitting(true);
    setGeneratedToken(null);
    setCopiedToken(false);

    try {
      const { invite, token } = await createInvite(
        userProfile.clinicId,
        {
          email: values.email,
          role: values.role,
          expiryDays: values.expiryDays ? parseInt(values.expiryDays) : 7,
        },
        userProfile.uid
      );

      setGeneratedToken(token);

      toast({
        title: "تم إنشاء الدعوة بنجاح!",
        description: `تم إرسال دعوة إلى ${values.email}`,
      });

      // Reload invites list
      await loadInvites(userProfile.clinicId);

      // Reset form
      form.reset();
    } catch (error: any) {
      console.error('Error creating invite:', error);
      toast({
        variant: "destructive",
        title: "فشل في إنشاء الدعوة",
        description: error.message || "حدث خطأ غير متوقع",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!generatedToken) return;

    const inviteUrl = `${window.location.origin}/accept-invite?token=${generatedToken}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(true);
      toast({
        title: "تم النسخ!",
        description: "تم نسخ رابط الدعوة إلى الحافظة",
      });

      setTimeout(() => setCopiedToken(false), 3000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        variant: "destructive",
        title: "فشل النسخ",
        description: "حاول مرة أخرى",
      });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!userProfile) return;

    try {
      await revokeInvite(inviteId, userProfile.clinicId);
      toast({
        title: "تم إلغاء الدعوة",
        description: "لم يعد بإمكان المستخدم قبول هذه الدعوة",
      });

      // Reload invites list
      await loadInvites(userProfile.clinicId);
    } catch (error) {
      console.error('Error revoking invite:', error);
      toast({
        variant: "destructive",
        title: "فشل إلغاء الدعوة",
        description: "حدث خطأ أثناء إلغاء الدعوة",
      });
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!userProfile) return;

    // Find the invite to check if it's accepted
    const invite = invites.find(inv => inv.id === inviteId);
    
    let confirmMessage = 'هل أنت متأكد من حذف هذه الدعوة؟ لا يمكن التراجع عن هذا الإجراء.';
    if (invite?.status === 'accepted') {
      confirmMessage = '⚠️ تحذير: هذه الدعوة مقبولة بالفعل!\n\nحذف هذه الدعوة سيؤدي إلى:\n- حذف حساب المستخدم تماماً من Firebase\n- حذف جميع بياناته من قاعدة البيانات\n- تسجيل خروجه تلقائياً\n- لا يمكن التراجع عن هذا الإجراء\n\nهل أنت متأكد من المتابعة؟';
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const { db } = getFirebase();
      const inviteRef = doc(db, 'clinics', userProfile.clinicId, 'invites', inviteId);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        throw new Error('الدعوة غير موجودة');
      }

      const inviteData = inviteSnap.data() as Invite;

      // If invite was accepted, try to permanently delete the user account
      if (inviteData.status === 'accepted' && inviteData.acceptedByUid) {
        const acceptedUid = inviteData.acceptedByUid;

        // Check if user still exists before trying to delete
        const userProfileRef = doc(db, 'userProfiles', acceptedUid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists()) {
          // User still exists, delete them
          const user = getFirebase().auth.currentUser;
          if (user) {
            const token = await user.getIdToken();
            const response = await fetch('/api/admin/delete-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ userId: acceptedUid, clinicId: userProfile.clinicId }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'فشل حذف حساب المستخدم');
            }

            console.log('User permanently deleted:', acceptedUid);
          }
        } else {
          // User already deleted manually, just remove the invite
          console.log('User already deleted, removing invite only:', acceptedUid);
        }
      }

      // Delete the invite
      await deleteDoc(inviteRef);
      
      toast({
        title: "تم حذف الدعوة",
        description: inviteData.status === 'accepted' 
          ? "تم حذف الدعوة والحساب تماماً من النظام"
          : "تم حذف الدعوة من القائمة",
      });

      // Reload invites list
      await loadInvites(userProfile.clinicId);
    } catch (error) {
      console.error('Error deleting invite:', error);
      toast({
        variant: "destructive",
        title: "فشل حذف الدعوة",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء حذف الدعوة",
      });
    }
  };

  const getStatusBadge = (status: InviteStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="default" className="bg-yellow-600"><Clock className="h-3 w-3 ml-1" />قيد الانتظار</Badge>;
      case 'accepted':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 ml-1" />مقبولة</Badge>;
      case 'revoked':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 ml-1" />ملغاة</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Clock className="h-3 w-3 ml-1" />منتهية</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: Timestamp | Date) => {
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  if (!userProfile) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة الدعوات</h1>
          <p className="text-muted-foreground">
            إنشاء دعوات آمنة للأطباء والممرضين الجدد
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/dashboard')}>
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى لوحة التحكم
        </Button>
      </div>

      {/* Create Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            إنشاء دعوة جديدة
          </CardTitle>
          <CardDescription>
            أدخل البريد الإلكتروني للموظف الجديد واختر الدور
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@example.com"
                  {...form.register('email')}
                  dir="ltr"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">الدور *</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) => form.setValue('role', value as 'doctor' | 'nurse')}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">طبيب</SelectItem>
                    <SelectItem value="nurse">ممرض</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.role && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.role.message}
                  </p>
                )}
              </div>

              {/* Expiry Days */}
              <div className="space-y-2">
                <Label htmlFor="expiryDays">مدة الصلاحية (أيام)</Label>
                <Input
                  id="expiryDays"
                  type="number"
                  min="1"
                  max="30"
                  placeholder="7"
                  {...form.register('expiryDays')}
                />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting ? "جاري الإنشاء..." : "إنشاء الدعوة"}
            </Button>
          </form>

          {/* Generated Token Display */}
          {generatedToken && (
            <div className="mt-6 p-4 border-2 border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800">تم إنشاء الدعوة بنجاح!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    انسخ الرابط أدناه وأرسله للموظف الجديد عبر البريد الإلكتروني أو الواتساب
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  value={`${window.location.origin}/accept-invite?token=${generatedToken}`}
                  readOnly
                  dir="ltr"
                  className="font-mono text-sm bg-white"
                />
                <Button
                  type="button"
                  onClick={handleCopyToken}
                  variant={copiedToken ? "default" : "outline"}
                >
                  {copiedToken ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 ml-2" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 ml-2" />
                      نسخ
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-green-700 mt-2">
                ⚠️ هذا الرابط صالح لمرة واحدة فقط ولمدة {form.watch('expiryDays') || 7} أيام
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Invites List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            الدعوات السابقة
          </CardTitle>
          <CardDescription>
            جميع الدعوات التي تم إنشاؤها لهذه العيادة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInvites ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>لم يتم إنشاء أي دعوات بعد</p>
              <p className="text-sm mt-2">ابدأ بإنشاء دعوة جديدة من النموذج أعلاه</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        {invite.role === 'doctor' ? (
                          <Badge variant="outline">طبيب</Badge>
                        ) : (
                          <Badge variant="outline">ممرض</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invite.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(invite.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(invite.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {invite.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevokeInvite(invite.id!)}
                            >
                              <XCircle className="h-4 w-4 ml-1" />
                              إلغاء
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInvite(invite.id!)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 ml-1" />
                            حذف
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800">كيفية دعوة موظفين جدد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-700">
          <p>1. أدخل البريد الإلكتروني للموظف الجديد واختر دوره (طبيب أو ممرض)</p>
          <p>2. انقر على "إنشاء الدعوة" للحصول على رابط دعوة آمن</p>
          <p>3. انسخ الرابط وأرسله للموظف عبر البريد الإلكتروني أو الواتساب</p>
          <p>4. سيقوم الموظف بفتح الرابط، إنشاء حساب أو تسجيل الدخول، ثم قبول الدعوة</p>
          <p>5. بعد القبول، سيظهر الموظف في قائمة الموظفين ويمكنه الوصول إلى لوحة التحكم الخاصة به</p>
        </CardContent>
      </Card>
    </div>
  );
}
