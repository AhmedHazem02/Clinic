
"use client";

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Users, QrCode, Trash2, PlayCircle } from 'lucide-react';
import { removePatientFromQueue, type PatientInQueue, listenToClinicSettings, updatePatientStatus } from '@/services/queueService';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const DEFAULT_CONSULTATION_TIME = 15; // in minutes

interface QueueListProps {
    title: string;
    allPatients: PatientInQueue[];
    queuePatients: PatientInQueue[];
    onShowQrCode: (patient: PatientInQueue) => void;
    searchQuery: string;
    isLoading: boolean;
}

export function QueueList({ title, allPatients, queuePatients, onShowQrCode, searchQuery, isLoading }: QueueListProps) {
    const [patientToCancel, setPatientToCancel] = useState<PatientInQueue | null>(null);
    const { toast } = useToast();
    const [consultationTime, setConsultationTime] = useState(DEFAULT_CONSULTATION_TIME);
    
    useEffect(() => {
        const unsubscribeSettings = listenToClinicSettings((settings) => {
            if (settings) {
                setConsultationTime(settings.consultationTime);
            }
        });

        // Cleanup subscription on component unmount
        return () => {
            unsubscribeSettings();
        };
    }, []);

    const filteredPatients = queuePatients.filter(patient => {
        const searchTerm = searchQuery.toLowerCase();
        const patientDate = format(patient.bookingDate, 'PPP').toLowerCase();

        return (
            patient.name.toLowerCase().includes(searchTerm) ||
            patient.phone.includes(searchTerm) ||
            patient.queueNumber.toString().includes(searchTerm) ||
            patientDate.includes(searchTerm)
        )
    });

    const isDoctorBusy = allPatients.some(p => p.status === 'Consulting');

    const handleStartConsultation = async (patient: PatientInQueue) => {
        if (isDoctorBusy) {
            toast({
                variant: "destructive",
                title: "Cannot start consultation",
                description: "Another patient is already in consultation.",
            });
            return;
        }
        try {
            await updatePatientStatus(patient.id, 'Consulting');
            toast({
                title: "Consultation Started",
                description: `${patient.name} is now in consultation.`,
            });
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not start the consultation.",
            });
        }
    };

    const calculateWaitTime = (queueNumber: number) => {
        const consultingPatient = allPatients.find(p => p.status === 'Consulting');
        const patientsAhead = allPatients.filter(p => p.status === 'Waiting' && p.queueNumber < queueNumber).length;
        
        let waitTime = patientsAhead * consultationTime;
        if (consultingPatient) {
            // A simple assumption that a consultation is halfway through on average
            waitTime += consultationTime / 2;
        }
        
        return Math.round(waitTime);
    }

    const getStatusBadgeVariant = (status: PatientInQueue['status']) => {
        switch (status) {
            case 'Consulting':
                return 'default';
            case 'Waiting':
                return 'secondary';
            case 'Finished':
                return 'outline';
            default:
                return 'secondary';
        }
    }

    const handleCancelReservation = async () => {
        if (!patientToCancel) return;
        try {
            await removePatientFromQueue(patientToCancel.id);
            toast({
                title: "Reservation Cancelled",
                description: `${patientToCancel.name}'s reservation has been cancelled.`,
            });
        } catch (error) {
            console.error("Error cancelling reservation:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not cancel the reservation.",
            });
        } finally {
            setPatientToCancel(null);
        }
    }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
            <Users className="text-primary"/> {title}
        </CardTitle>
        <CardDescription>
          Live view of patients waiting for consultation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
             <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
             </div>
        ) : (
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[80px]">Queue #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Est. Wait</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                        <TableCell className="font-bold text-lg">{patient.queueNumber}</TableCell>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        <TableCell>{patient.status === 'Waiting' ? `${calculateWaitTime(patient.queueNumber)} min` : '-'}</TableCell>
                        <TableCell>
                            <Badge variant={getStatusBadgeVariant(patient.status)}>{patient.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            {patient.status === 'Waiting' && (
                                <Button variant="outline" size="sm" onClick={() => handleStartConsultation(patient)} disabled={isDoctorBusy}>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Start
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => onShowQrCode(patient)}>
                                <QrCode className="mr-2 h-4 w-4" />
                                QR
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setPatientToCancel(patient)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                            {searchQuery ? "No patients match your search." : "No patients in the queue yet."}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>
    <AlertDialog open={!!patientToCancel} onOpenChange={(open) => !open && setPatientToCancel(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently cancel the reservation for {patientToCancel?.name}. This action cannot be undone.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelReservation} className="bg-destructive hover:bg-destructive/90">
                Yes, cancel reservation
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
