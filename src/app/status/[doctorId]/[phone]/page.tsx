
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  listenToQueue,
  type PatientInQueue,
  listenToDoctorMessage,
  listenToDoctorAvailability,
  getDoctorProfile,
} from "@/services/queueService";
import { PatientStatusCard } from "@/components/patient-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  UserCheck,
  Bell,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PatientStatusPage({
  params: { doctorId, phone },
}: {
  params: { doctorId: string; phone: string };
}) {
  const [patientData, setPatientData] = useState<PatientInQueue | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [isDoctorAvailable, setIsDoctorAvailable] = useState(true);
  const [doctorName, setDoctorName] = useState<string>("");

  // State for one-time notifications
  const [showDoctorAvailableAlert, setShowDoctorAvailableAlert] = useState(false);
  const [showTurnSoonAlert, setShowTurnSoonAlert] = useState(false);
  const [showDoctorUnavailableAlert, setShowDoctorUnavailableAlert] = useState(true);

  // Refs to track previous states
  const prevDoctorAvailableRef = useRef<boolean>();
  const turnSoonAlertShownRef = useRef(false);

  useEffect(() => {
    if (phone && doctorId) {
      setIsLoading(true);
      setError(null);

      // Fetch doctor's name
      getDoctorProfile(doctorId).then((profile) => {
        if (profile) {
          setDoctorName(profile.name);
        }
      });

      const unsubscribeQueue = listenToQueue(
        doctorId,
        (queue) => {
          const patient = queue.find(
            (p) => p.phone === phone && p.status !== "Finished"
          );

          if (patient) {
            setPatientData(patient);
            const waitingPatients = queue.filter(
              (p) =>
                p.status === "Waiting" &&
                (p.queueType || "Consultation") ===
                  (patient.queueType || "Consultation")
            );
            const ahead = waitingPatients.filter(
              (p) => p.queueNumber < patient.queueNumber
            ).length;
            setPeopleAhead(ahead);

            // Check for "turn is soon" condition
            if (ahead === 2 && !turnSoonAlertShownRef.current) {
              setShowTurnSoonAlert(true);
              turnSoonAlertShownRef.current = true; // Ensure it's only shown once
            } else if (ahead > 2) {
              // If patient count goes up, reset the flag
              turnSoonAlertShownRef.current = false;
              setShowTurnSoonAlert(false);
            }
          } else {
            setPatientData(null);
            setError("لم يتم العثور على حجز نشط لهذا المريض.");
          }
          setIsLoading(false);
        },
        (error) => {
          setError(
            "لا يمكن استرداد بيانات قائمة الانتظار. يرجى المحاولة مرة أخرى."
          );
          setIsLoading(false);
        }
      );

      const unsubscribeAvailability = listenToDoctorAvailability(
        doctorId,
        (available) => {
          // Check if the doctor was previously unavailable and is now available
          if (prevDoctorAvailableRef.current === false && available === true) {
            setShowDoctorAvailableAlert(true);
          }
          prevDoctorAvailableRef.current = available;
          setIsDoctorAvailable(available);
          setShowDoctorUnavailableAlert(true); // Reset the unavailable alert visibility
        }
      );

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

        {doctorName && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold">
              أهلاً بك في عيادة د. {doctorName}
            </h2>
          </div>
        )}

        {showDoctorAvailableAlert && (
          <Alert className="bg-green-100 border-green-400 text-green-700 relative pr-10">
            <UserCheck className="h-4 w-4 text-green-700" />
            <AlertTitle>الطبيب متاح الآن</AlertTitle>
            <AlertDescription>
              استأنف الطبيب الاستشارات. قائمة الانتظار تتحرك الآن.
            </AlertDescription>
            <button
              onClick={() => setShowDoctorAvailableAlert(false)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-green-200"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        )}

        {showTurnSoonAlert && (
          <Alert className="bg-yellow-100 border-yellow-400 text-yellow-800 relative pr-10">
            <Bell className="h-4 w-4 text-yellow-800" />
            <AlertTitle>دورك قريب!</AlertTitle>
            <AlertDescription>
              يوجد مريضان فقط أمامك. يرجى الاستعداد لاستشارتك.
            </AlertDescription>
             <button
              onClick={() => setShowTurnSoonAlert(false)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-yellow-200"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        )}

        {doctorMessage && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>رسالة من الطبيب</AlertTitle>
            <AlertDescription>{doctorMessage}</AlertDescription>
          </Alert>
        )}
        
        {!isDoctorAvailable && showDoctorUnavailableAlert && patientData?.status === "Waiting" && (
          <Alert variant="destructive" className="relative pr-10">
            <Info className="h-4 w-4" />
            <AlertTitle>الطبيب غير متاح حاليًا</AlertTitle>
            <AlertDescription>
              تم إيقاف عداد وقت الانتظار مؤقتًا وسيستأنف عندما يكون الطبيب
              متاحًا.
            </AlertDescription>
             <button
              onClick={() => setShowDoctorUnavailableAlert(false)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-destructive/20"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
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
          <PatientStatusCard
            data={patientData}
            peopleAhead={peopleAhead}
            isDoctorAvailable={isDoctorAvailable}
          />
        )}
      </div>
    </main>
  );
}
