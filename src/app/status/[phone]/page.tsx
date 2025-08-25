
"use client";

import React, { useEffect, useState } from "react";
import { listenToQueue, type PatientInQueue, listenToDoctorMessage } from "@/services/queueService";
import { PatientStatusCard } from "@/components/patient-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PatientStatusPage({ params }: { params: { phone: string } }) {
  const { phone } = React.use(params);

  const [patientData, setPatientData] = useState<PatientInQueue | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (phone) {
      setIsLoading(true);
      setError(null);

      const unsubscribeQueue = listenToQueue((queue) => {
        const currentPatient = queue.find(p => p.phone === phone);

        if (currentPatient) {
          const patientsAhead = queue.filter(p => 
            p.status === 'Waiting' && p.queueNumber < currentPatient.queueNumber
          ).length;
          
          setPatientData(currentPatient);
          setPeopleAhead(patientsAhead);
        } else {
          setError("No active patient found with this phone number in the queue.");
        }
        setIsLoading(false);
      }, (err) => {
          console.error("Error fetching patient status:", err);
          setError("An error occurred while fetching the patient status.");
          setIsLoading(false);
      });

      const unsubscribeMessage = listenToDoctorMessage((message) => {
        setDoctorMessage(message);
      });

      // Cleanup subscription on component unmount
      return () => {
        unsubscribeQueue();
        unsubscribeMessage();
      };
    }
  }, [phone]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md mx-auto space-y-6">
            <div className="mb-6">
                <Button variant="ghost" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2" />
                        Back to Search
                    </Link>
                </Button>
            </div>

            {doctorMessage && (
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>A Message from the Doctor</AlertTitle>
                    <AlertDescription>
                        {doctorMessage}
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

            {error && (
                <Card className="w-full border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle /> Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                    </CardContent>
                </Card>
            )}

            {patientData && (
                <PatientStatusCard data={patientData} peopleAhead={peopleAhead} />
            )}
        </div>
    </main>
  );
}
