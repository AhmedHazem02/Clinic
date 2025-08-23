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
import { Users, QrCode, Trash2 } from 'lucide-react';
import { listenToTodaysQueue, removePatientFromQueue, type PatientInQueue } from '@/services/queueService';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';


const CONSULTATION_TIME = 15; // in minutes

interface QueueListProps {
    onShowQrCode: (patient: PatientInQueue) => void;
}

export function QueueList({ onShowQrCode }: QueueListProps) {
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [patientToCancel, setPatientToCancel] = useState<PatientInQueue | null>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        const unsubscribe = listenToTodaysQueue((updatedQueue) => {
            setPatients(updatedQueue);
            setIsLoading(false);
        });

        // Cleanup subscription on component unmount
        return () => unsubscribe();
    }, []);

    const calculateWaitTime = (queueNumber: number) => {
        const consultingPatient = patients.find(p => p.status === 'Consulting');
        if (!consultingPatient) return 0;

        const patientsAhead = patients.filter(p => p.status === 'Waiting' && p.queueNumber < queueNumber).length;
        
        return (patientsAhead) * CONSULTATION_TIME;
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
            <Users className="text-primary"/> Today's Queue
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
                {patients.length > 0 ? (
                    patients.filter(p => p.status !== 'Finished').map((patient) => (
                    <TableRow key={patient.id}>
                        <TableCell className="font-bold text-lg">{patient.queueNumber}</TableCell>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        <TableCell>{patient.status === 'Waiting' ? `${calculateWaitTime(patient.queueNumber)} min` : '-'}</TableCell>
                        <TableCell>
                            <Badge variant={getStatusBadgeVariant(patient.status)}>{patient.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => onShowQrCode(patient)}>
                                <QrCode className="mr-2 h-4 w-4" />
                                Show QR
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setPatientToCancel(patient)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No patients in the queue yet.
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
            <AlertDialogAction onClick={handleCancelReservation}>
                Yes, cancel reservation
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
