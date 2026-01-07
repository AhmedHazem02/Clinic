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
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Clock, Users, MessageSquare, Phone, MapPin, RefreshCw, Stethoscope, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getBookingTicket } from "@/services/bookingTicketService";
import { getDoctorById, getClinicById } from "@/services/clinicPublicService";
import { listenToQueueState } from "@/services/queueStateService";
import { getLatestDoctorMessage } from "@/services/queueService";
import type { DoctorMessage } from "@/services/queueService";
import { BookingTicket, QueueState } from "@/types/multitenant";
import { Clinic, Doctor } from "@/types/multitenant";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

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
  const [doctorMessage, setDoctorMessage] = useState<DoctorMessage | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

        // Fetch latest doctor message
        try {
          const latestMessage = await getLatestDoctorMessage(doctorId, clinicId);
          if (latestMessage) {
            setDoctorMessage(latestMessage);
          }
        } catch (err) {
          console.error("Error fetching doctor message:", err);
        }

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
      setLastUpdated(new Date());
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

  // Calculate estimated wait time (improved with actual average if available)
  useEffect(() => {
    if (clinic && peopleAhead > 0) {
      // Use actual average wait time if available from queueState
      if (queueState?.averageWaitTimeMinutes && queueState.averageWaitTimeMinutes > 0) {
        setEstimatedWaitTime(Math.round(peopleAhead * queueState.averageWaitTimeMinutes));
      } else {
        // Fallback to clinic's consultation time setting
        const consultationTime = clinic.settings?.consultationTime || 15;
        setEstimatedWaitTime(peopleAhead * consultationTime);
      }
    } else {
      setEstimatedWaitTime(0);
    }
  }, [clinic, peopleAhead, queueState]);

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
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Stethoscope className="h-4 w-4" />
              <p>د. {doctor.name} - {doctor.specialty}</p>
            </div>
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
              
              {/* Show current consulting number if waiting */}
              {ticket.status === 'Waiting' && queueState?.currentConsultingQueueNumber && (
                <p className="text-sm text-gray-500 mt-2">
                  جاري الكشف على رقم: <span className="font-bold text-blue-600">#{queueState.currentConsultingQueueNumber}</span>
                </p>
              )}
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

        {ticket.status === 'Waiting' && peopleAhead === 0 && (
          <Alert className="bg-green-50 border-green-300">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800 font-semibold">
              🎉 دورك التالي! يرجى الاستعداد
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

        {/* Doctor Message Alert */}
        {doctorMessage && doctorMessage.message && (
          <Alert className="bg-purple-50 border-purple-200">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            <AlertDescription className="text-purple-900">
              <p className="font-semibold mb-1">رسالة من الطبيب:</p>
              <p>{doctorMessage.message}</p>
              {doctorMessage.createdAt?.toDate?.() && (
                <p className="text-xs text-purple-600 mt-2">
                  {format(doctorMessage.createdAt.toDate(), "dd/MM/yyyy - hh:mm a", { locale: ar })}
                </p>
              )}
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
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-600">الوقت المتوقع:</span>
                  <span className="text-xl font-semibold text-gray-800">
                    حوالي {estimatedWaitTime} دقيقة
                  </span>
                </div>
              )}

              {/* Show total waiting if available */}
              {queueState?.totalWaitingCount !== undefined && (
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-600">إجمالي المنتظرين:</span>
                  <span className="text-lg font-semibold text-gray-800">
                    {queueState.totalWaitingCount} شخص
                  </span>
                </div>
              )}

              {/* Show consultation price */}
              {clinic.settings?.consultationCost && (
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600">سعر الكشف:</span>
                  <span className="text-lg font-semibold text-green-600">
                    {clinic.settings.consultationCost} جنيه
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

        {/* Clinic Contact Info */}
        {(clinic.phoneNumbers?.length > 0 || clinic.locations?.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                معلومات العيادة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clinic.phoneNumbers?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">للتواصل:</p>
                  <div className="flex flex-wrap gap-2">
                    {clinic.phoneNumbers.map((phone, idx) => (
                      <a 
                        key={idx} 
                        href={`tel:${phone}`}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {clinic.locations?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">العنوان:</p>
                  {clinic.locations.map((location, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-700">{location}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Auto-refresh notice */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            يتم تحديث الحالة تلقائياً • لا حاجة لتحديث الصفحة
          </p>
          <p className="text-xs text-gray-400">
            آخر تحديث: {format(lastUpdated, "hh:mm:ss a", { locale: ar })}
          </p>
        </div>
      </div>
    </main>
  );
}
