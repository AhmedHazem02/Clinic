"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, MapPin, Clock, ArrowLeft } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { Clinic } from "@/types/multitenant";
import Link from "next/link";

export default function SelectClinicPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveClinics();
  }, []);

  const loadActiveClinics = async () => {
    try {
      console.log('[Book Page] Starting to load active clinics...');
      const { db } = getFirebase();

      if (!db) {
        console.error('[Book Page] Firebase not initialized');
        setError('فشل الاتصال بقاعدة البيانات');
        setLoading(false);
        return;
      }

      console.log('[Book Page] Firebase initialized, fetching clinics...');
      const clinicsRef = collection(db, 'clinics');
      const q = query(clinicsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);
      console.log('[Book Page] Clinics fetched:', snapshot.size, 'clinics');

      const loadedClinics: Clinic[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedClinics.push({
          id: doc.id,
          name: data.name,
          slug: data.slug,
          ownerUid: data.ownerUid,
          ownerId: data.ownerUid,
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail || '',
          settings: data.settings || {},
          phoneNumbers: data.phoneNumbers || [],
          locations: data.locations || [],
          isActive: data.isActive,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || data.createdAt,
        } as Clinic);
      });

      console.log('[Book Page] Loaded clinics:', loadedClinics);

      if (loadedClinics.length === 1) {
        // If only one clinic, redirect directly
        const clinic = loadedClinics[0];
        if (!clinic.slug || clinic.slug.trim() === '') {
          console.error('[Book Page] Clinic has no slug:', clinic.id);
          setError(`العيادة "${clinic.name}" ليس لها معرف (slug) محدد. يرجى الاتصال بالإدارة.`);
          setLoading(false);
          return;
        }
        console.log('[Book Page] Only one clinic, redirecting to:', clinic.slug);
        router.push(`/book/${clinic.slug}`);
      } else {
        console.log('[Book Page] Multiple clinics, showing selection page');
        setClinics(loadedClinics);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[Book Page] Error loading clinics:', err);
      console.error('[Book Page] Error details:', err.message, err.code);
      setError(`فشل تحميل العيادات المتاحة: ${err.message || 'خطأ غير معروف'}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="inline-block p-4 bg-destructive/10 rounded-full mb-4">
            <Stethoscope className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            حدث خطأ
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (clinics.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="inline-block p-4 bg-muted rounded-full mb-4">
            <Stethoscope className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            لا توجد عيادات متاحة
          </h1>
          <p className="text-muted-foreground mb-6">
            لا يوجد عيادات مفعّلة حالياً للحجز
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Stethoscope className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            اختر العيادة
          </h1>
          <p className="text-muted-foreground mt-2">
            حدد العيادة التي تريد الحجز فيها
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {clinics.map((clinic) => (
            <Card
              key={clinic.id}
              className="border-2 hover:border-primary transition-all hover:shadow-lg cursor-pointer"
              onClick={() => router.push(`/book/${clinic.slug}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{clinic.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{clinic.slug}</span>
                    </CardDescription>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Stethoscope className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>متاح للحجز الآن</span>
                </div>
                <Button className="w-full" size="lg">
                  احجز موعد
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
