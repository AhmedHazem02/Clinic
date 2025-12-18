"use client";

/**
 * Staff Management Page (Admin/Owner Only)
 *
 * Lists all doctors and nurses in the clinic.
 * Allows owner to view staff members and their status.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, UserCog, Stethoscope, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { onAuthChange } from "@/services/authClientService";
import { getUserProfileWithLegacyFallback, isModernProfile } from "@/services/userProfileService";
import { getClinicDoctors, getClinicNurses } from "@/services/queueService";
import type { UserProfile } from "@/types/multitenant";

interface DoctorData {
  id: string;
  name: string;
  email: string;
  specialty: string;
  isActive: boolean;
  isAvailable: boolean;
  totalRevenue: number;
}

interface NurseData {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

export default function StaffManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [nurses, setNurses] = useState<NurseData[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

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

        // Load staff data
        await loadStaffData(profile.clinicId);
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

  const loadStaffData = async (clinicId: string) => {
    setIsLoadingStaff(true);
    try {
      const [doctorsData, nursesData] = await Promise.all([
        getClinicDoctors(clinicId),
        getClinicNurses(clinicId),
      ]);

      setDoctors(doctorsData);
      setNurses(nursesData);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل في تحميل بيانات الموظفين",
      });
    } finally {
      setIsLoadingStaff(false);
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

  if (!userProfile) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة الموظفين</h1>
          <p className="text-muted-foreground">
            عرض وإدارة الأطباء والممرضين في العيادة
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/dashboard')}>
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى لوحة التحكم
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأطباء</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{doctors.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الممرضين</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nurses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الأطباء المتاحون</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {doctors.filter(d => d.isAvailable && d.isActive).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            الأطباء
          </CardTitle>
          <CardDescription>
            قائمة جميع الأطباء في العيادة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStaff ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>لا يوجد أطباء في العيادة بعد</p>
              <p className="text-sm mt-2">قم بدعوة أطباء جدد من صفحة الدعوات</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/admin/invites')}
              >
                إنشاء دعوة
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">التخصص</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التوفر</TableHead>
                    <TableHead className="text-right">الإيرادات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((doctor) => (
                    <TableRow key={doctor.id}>
                      <TableCell className="font-medium">{doctor.name}</TableCell>
                      <TableCell className="text-muted-foreground">{doctor.email}</TableCell>
                      <TableCell>{doctor.specialty || '-'}</TableCell>
                      <TableCell>
                        {doctor.isActive ? (
                          <Badge variant="default">نشط</Badge>
                        ) : (
                          <Badge variant="secondary">غير نشط</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {doctor.isAvailable ? (
                          <Badge variant="default" className="bg-green-600">متاح</Badge>
                        ) : (
                          <Badge variant="secondary">غير متاح</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {doctor.totalRevenue.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nurses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            الممرضون
          </CardTitle>
          <CardDescription>
            قائمة جميع الممرضين في العيادة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStaff ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : nurses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>لا يوجد ممرضون في العيادة بعد</p>
              <p className="text-sm mt-2">قم بدعوة ممرضين جدد من صفحة الدعوات</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/admin/invites')}
              >
                إنشاء دعوة
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nurses.map((nurse) => (
                    <TableRow key={nurse.id}>
                      <TableCell className="font-medium">{nurse.name}</TableCell>
                      <TableCell className="text-muted-foreground">{nurse.email}</TableCell>
                      <TableCell>
                        {nurse.isActive ? (
                          <Badge variant="default">نشط</Badge>
                        ) : (
                          <Badge variant="secondary">غير نشط</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle>إضافة موظفين جدد</CardTitle>
          <CardDescription className="text-blue-700">
            استخدم صفحة الدعوات لإنشاء روابط دعوة آمنة للأطباء والممرضين الجدد
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/admin/invites')}>
            انتقل إلى صفحة الدعوات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
