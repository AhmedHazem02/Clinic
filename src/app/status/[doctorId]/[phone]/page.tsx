
"use client";

import React, { useEffect, useState } from "react";
import { listenToQueue, type PatientInQueue, listenToDoctorMessage, listenToDoctorAvailability } from "@/services/queueService";
import { PatientStatusCard } from "@/components/patient-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PatientStatusPage({ params: { doctorId, phone } }: { params: { doctorId: string, phone: string } }) {

  const [patientData, setPatientData] = useState<PatientInQueue | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [isDoctorAvailable, setIsDoctorAvailable] = useState(true);

  useEffect(() => {
    if (phone && doctorId) {
      setIsLoading(true);
      setError(null);

      const unsubscribeQueue = listenToQueue(doctorId, (queue) => {
        const patient = queue.find(p => p.phone === phone && p.status !== 'Finished');
        
        if (patient) {
          setPatientData(patient);
          const waitingPatients = queue.filter(p => p.status === 'Waiting' && (p.queueType || 'Consultation') === (patient.queueType || 'Consultation'));
          const ahead = waitingPatients.filter(p => p.queueNumber < patient.queueNumber).length;
          setPeopleAhead(ahead);
        } else {
          setPatientData(null);
          setError("لم يتم العثور على حجز نشط لهذا المريض.");
        }
        setIsLoading(false);
      }, (error) => {
        setError("لا يمكن استرداد بيانات قائمة الانتظار. يرجى المحاولة مرة أخرى.");
        setIsLoading(false);
      });

      const unsubscribeAvailability = listenToDoctorAvailability(doctorId, (available) => {
          setIsDoctorAvailable(available);
      });

      const unsubscribeMessage = listenToDoctorMessage(doctorId, (message) => {
        setDoctorMessage(message);
      });

      // Cleanup subscription on component unmount
      return () => {
        unsubscribeQueue();
        unsubscribeAvailability();
        unsubscribeMessage();
      };
    } else {
        setError("معرف الطبيب أو رقم الهاتف مفقود.");
        setIsLoading(false);
    }
  }, [phone, doctorId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md mx-auto space-y-6">
            <div className="mb-6">
                <Button variant="ghost" asChild>
                    <Link href="/">
                        <ArrowLeft className="ml-2" />
                        العودة إلى البحث
                    </Link>
                </Button>
            </div>

            {doctorMessage && (
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>رسالة من الطبيب</AlertTitle>
                    <AlertDescription>
                        {doctorMessage}
                    </AlertDescription>
                </Alert>
            )}
             {!isDoctorAvailable && patientData?.status === 'Waiting' && (
                 <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>الطبيب غير متاح حاليًا</AlertTitle>
                    <AlertDescription>
                        تم إيقاف عداد وقت الانتظار مؤقتًا وسيستأنف عندما يكون الطبيب متاحًا.
                    </AlertDescription>
                </Alert>
            )}

            {isLoading && (
                 <Card className="w-full">
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                        <Skeleton className="h-px w-full" />
                        <div className="space-y-2">
                             <Skeleton className="h-5 w-3/4" />
                             <Skeleton className="h-5 w-1/2" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {error && !patientData && (
                <Card className="w-full border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle /> خطأ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                    </CardContent>
                </Card>
            )}

            {patientData && (
                <PatientStatusCard data={patientData} peopleAhead={peopleAhead} isDoctorAvailable={isDoctorAvailable}/>
            )}
        </div>
    </main>
  );
}
