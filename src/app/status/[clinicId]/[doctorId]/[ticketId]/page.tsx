"use client";

/**
 * Secure Patient Status Page (Step 5)
 * 
 * Privacy-safe status page using get-only access (no list queries).
 * Prevents scraping by reading only:
 * - Single booking ticket document
 * - Single queue state document
 * 
 * Route: /status/[clinicId]/[doctorId]/[ticketId]
 */

import React, { useEffect, useState, use } from "react";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getBookingTicket } from "@/services/bookingTicketService";
import { getDoctorById, getClinicById } from "@/services/clinicPublicService";
import { listenToQueueState } from "@/services/queueStateService";
import { BookingTicket, QueueState } from "@/types/multitenant";
import { Clinic, Doctor } from "@/types/multitenant";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";

export default function PatientStatusPage({
  params,
}: {
  params: Promise<{ clinicId: string; doctorId: string; ticketId: string }>;
}) {
  const { clinicId, doctorId, ticketId } = use(params);

  const [ticket, setTicket] = useState<BookingTicket | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch ticket (get-only access)
        const ticketData = await getBookingTicket(ticketId);
        if (!ticketData) {
          setError("لم يتم العثور على الحجز. قد يكون منتهي الصلاحية.");
          setIsLoading(false);
          return;
        }

        // Verify ticket matches URL params
        if (ticketData.clinicId !== clinicId || ticketData.doctorId !== doctorId) {
          setError("معلومات الحجز غير صحيحة.");
          setIsLoading(false);
          return;
        }

        setTicket(ticketData);

        // Fetch clinic and doctor info
        const [clinicData, doctorData] = await Promise.all([
          getClinicById(clinicId),
          getDoctorById(doctorId),
        ]);

        if (!clinicData || !doctorData) {
          setError("لم يتم العثور على بيانات العيادة أو الطبيب.");
          setIsLoading(false);
          return;
        }

        setClinic(clinicData);
        setDoctor(doctorData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading status data:", err);
        setError("حدث خطأ في تحميل بيانات الحالة.");
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [ticketId, clinicId, doctorId]);

  // Listen to ticket updates (real-time) using get-only access
  useEffect(() => {
    if (!ticketId) return;

    const { db } = getFirebase();
    const ticketRef = doc(db, 'bookingTickets', ticketId);

    const unsubscribe = onSnapshot(
      ticketRef,
      (snap) => {
        if (snap.exists()) {
          setTicket({ id: snap.id, ...snap.data() } as BookingTicket);
        }
      },
      (error) => {
        console.error("Error listening to ticket:", error);
      }
    );

    return () => unsubscribe();
  }, [ticketId]);

  // Listen to queue state updates (real-time) using get-only access
  useEffect(() => {
    if (!clinicId || !doctorId) return;

    const unsubscribe = listenToQueueState(clinicId, doctorId, (state) => {
      setQueueState(state);
    });

    return () => unsubscribe();
  }, [clinicId, doctorId]);

  // Calculate people ahead using queueState (no list queries)
  useEffect(() => {
    if (!ticket || !queueState) return;

    const currentQueueNumber = queueState.currentConsultingQueueNumber;
    
    if (currentQueueNumber === null) {
      // No one is being seen yet
      setPeopleAhead(ticket.queueNumber - 1);
    } else if (ticket.queueNumber <= currentQueueNumber) {
      // Your turn or already passed
      setPeopleAhead(0);
    } else {
      // Calculate based on current consulting number
      setPeopleAhead(ticket.queueNumber - currentQueueNumber - 1);
    }
  }, [ticket, queueState]);

  // Calculate estimated wait time
  useEffect(() => {
    if (clinic && peopleAhead > 0) {
      const consultationTime = clinic.settings?.consultationTime || 15;
      setEstimatedWaitTime(peopleAhead * consultationTime);
    } else {
      setEstimatedWaitTime(0);
    }
  }, [clinic, peopleAhead]);

  // Loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md mx-auto space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">جاري تحميل حالة الحجز...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !ticket || !clinic || !doctor) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md mx-auto space-y-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="ml-2" />
              العودة للرئيسية
            </Link>
          </Button>

          <Card className="border-red-200">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">خطأ</h2>
              <p className="text-gray-600 text-center">{error || "حدث خطأ غير متوقع"}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Get status badge info
  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'Waiting':
        return { label: 'في الانتظار', variant: 'default' as const, color: 'bg-orange-500' };
      case 'Consulting':
        return { label: 'دورك الآن', variant: 'default' as const, color: 'bg-green-500' };
      case 'Finished':
        return { label: 'انتهى الكشف', variant: 'secondary' as const, color: 'bg-gray-500' };
      default:
        return { label: 'غير معروف', variant: 'outline' as const, color: 'bg-gray-400' };
    }
  };

  const statusBadge = getStatusBadge();

  // Render status content
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="ml-2" />
            العودة للرئيسية
          </Link>
        </Button>

        {/* Clinic Header */}
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900">{clinic.name}</CardTitle>
            <p className="text-gray-600">د. {doctor.name} - {doctor.specialty}</p>
          </CardHeader>
        </Card>

        {/* Queue Number Card */}
        <Card className="border-2">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <p className="text-gray-600">رقم الكشف الخاص بك</p>
              <p className="text-6xl font-bold text-blue-600">
                #{ticket.queueNumber}
              </p>
              <Badge className={`${statusBadge.color} text-white px-4 py-2 text-lg`}>
                {statusBadge.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Status Alerts */}
        {ticket.status === 'Consulting' && (
          <Alert className="bg-green-50 border-green-300">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800 font-semibold">
              دورك الآن! يرجى الدخول لغرفة الكشف
            </AlertDescription>
          </Alert>
        )}

        {ticket.status === 'Waiting' && peopleAhead > 0 && peopleAhead <= 2 && (
          <Alert className="bg-yellow-50 border-yellow-300">
            <Clock className="h-5 w-5 text-yellow-600" />
            <AlertDescription className="text-yellow-800 font-semibold">
              ⏰ دورك قريب! يرجى التواجد في العيادة ({peopleAhead} {peopleAhead === 1 ? 'شخص' : 'أشخاص'} قبلك)
            </AlertDescription>
          </Alert>
        )}

        {ticket.status === 'Finished' && (
          <Alert className="bg-blue-50 border-blue-300">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-800">
              تم الانتهاء من الكشف. شكراً لزيارتك!
            </AlertDescription>
          </Alert>
        )}

        {/* Queue Info */}
        {ticket.status === 'Waiting' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                معلومات قائمة الانتظار
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">عدد الأشخاص قبلك:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {peopleAhead}
                </span>
              </div>
              
              {estimatedWaitTime > 0 && (
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600">الوقت المتوقع:</span>
                  <span className="text-xl font-semibold text-gray-800">
                    حوالي {estimatedWaitTime} دقيقة
                  </span>
                </div>
              )}

              {!queueState && (
                <div className="text-sm text-gray-500 text-center py-2">
                  معلومات قائمة الانتظار غير متاحة حالياً
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* Auto-refresh notice */}
        <p className="text-center text-sm text-gray-500">
          يتم تحديث الحالة تلقائياً • لا حاجة لتحديث الصفحة
        </p>
      </div>
    </main>
  );
}
