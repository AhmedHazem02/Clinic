
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
import { Users, QrCode, Trash2, PlayCircle, CheckCircle } from 'lucide-react';
import { removePatientFromQueue, type PatientInQueue, listenToClinicSettings, updatePatientStatus, finishConsultation } from '@/services/queueService';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useNurseProfile } from './nurse-profile-provider';

const DEFAULT_CONSULTATION_TIME = 15; // in minutes

interface QueueListProps {
    title: string;
    allPatients: PatientInQueue[];
    queuePatients: PatientInQueue[];
    onShowQrCode: (patient: PatientInQueue) => void;
    searchQuery: string;
    isLoading: boolean;
    showDoctorColumn?: boolean;
    getDoctorName?: (doctorId: string) => string;
}

export function QueueList({ title, allPatients, queuePatients, onShowQrCode, searchQuery, isLoading, showDoctorColumn, getDoctorName }: QueueListProps) {
    const { userProfile } = useNurseProfile();
    const [patientToCancel, setPatientToCancel] = useState<PatientInQueue | null>(null);
    const { toast } = useToast();
    const [consultationTime, setConsultationTime] = useState(DEFAULT_CONSULTATION_TIME);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every second for accurate countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // Update every second

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const clinicId = userProfile && 'clinicId' in userProfile ? userProfile.clinicId : undefined;

        const unsubscribeSettings = listenToClinicSettings((settings) => {
            if (settings) {
                setConsultationTime(settings.consultationTime);
            }
        }, clinicId);

        // Cleanup subscription on component unmount
        return () => {
            unsubscribeSettings();
        };
    }, [userProfile]);

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
                title: "لا يمكن بدء الاستشارة",
                description: "يوجد مريض آخر قيد الاستشارة بالفعل.",
            });
            return;
        }
        try {
            await updatePatientStatus(patient.id, 'Consulting');
            toast({
                title: "بدأت الاستشارة",
                description: `${patient.name} الآن في الاستشارة.`,
            });
        } catch (error) {
             toast({
                variant: "destructive",
                title: "خطأ",
                description: "لا يمكن بدء الاستشارة.",
            });
        }
    };

    const handleFinishConsultation = async (patient: PatientInQueue) => {
        try {
            await finishConsultation(patient.id);
            toast({
                title: "تم إنهاء الكشف",
                description: `تم إنهاء كشف ${patient.name} بنجاح.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "خطأ",
                description: "لا يمكن إنهاء الكشف.",
            });
        }
    };

    const calculateWaitTime = (queueNumber: number) => {
        const consultingPatient = allPatients.find(p => p.status === 'Consulting');
        const patientsAhead = allPatients.filter(p => p.status === 'Waiting' && p.queueNumber < queueNumber).length;

        // Calculate average consultation time from recently finished patients (for more accurate estimation)
        const finishedPatientsToday = allPatients.filter(p =>
            p.status === 'Finished' &&
            p.consultingStartTime &&
            p.finishedAt
        );

        let avgConsultationTime = consultationTime; // Default from settings

        if (finishedPatientsToday.length > 0) {
            // Calculate actual average from last 5 finished patients
            const recentFinished = finishedPatientsToday.slice(-5);
            const totalActualTime = recentFinished.reduce((sum, patient) => {
                const startTime = (patient.consultingStartTime as any).toDate?.() || new Date(patient.consultingStartTime as any);
                const endTime = (patient.finishedAt as any).toDate?.() || new Date(patient.finishedAt as any);
                const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
                return sum + duration;
            }, 0);
            avgConsultationTime = totalActualTime / recentFinished.length;
            console.log(`📊 Average consultation time from ${recentFinished.length} patients: ${avgConsultationTime.toFixed(1)} min`);
        }

        let waitTime = 0;

        // Calculate time for consulting patient (if any) - using REAL-TIME tracking
        if (consultingPatient) {
            let consultingStartTime = consultingPatient.consultingStartTime
                ? (consultingPatient.consultingStartTime as any).toDate?.() || new Date(consultingPatient.consultingStartTime as any)
                : null;

            if (consultingStartTime) {
                // PRECISE calculation: elapsed time since consultation started
                const elapsedMinutes = (currentTime.getTime() - consultingStartTime.getTime()) / (1000 * 60);
                // Use actual average time instead of fixed consultationTime
                const remainingTime = Math.max(0, avgConsultationTime - elapsedMinutes);
                waitTime += remainingTime;
            } else {
                // Fallback: use average
                waitTime += avgConsultationTime / 2;
            }
        }

        // Add time for all waiting patients ahead (using calculated average)
        waitTime += patientsAhead * avgConsultationTime;

        return Math.max(0, waitTime); // Never negative
    }

    const formatWaitTime = (minutes: number) => {
        if (minutes < 1) {
            const seconds = Math.round(minutes * 60);
            return `${seconds} ثانية`;
        }

        const wholeMinutes = Math.floor(minutes);
        const seconds = Math.round((minutes - wholeMinutes) * 60);

        if (seconds > 0) {
            return `${wholeMinutes} د ${seconds} ث`;
        }
        return `${wholeMinutes} دقيقة`;
    }

    const translateStatus = (status: PatientInQueue['status']) => {
        switch (status) {
            case 'Consulting':
                return 'في الكشف';
            case 'Waiting':
                return 'في الانتظار';
            case 'Finished':
                return 'مكتمل';
            default:
                return status;
        }
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
                title: "تم إلغاء الحجز",
                description: `تم إلغاء حجز ${patientToCancel.name}.`,
            });
        } catch (error) {
            console.error("Error cancelling reservation:", error);
            toast({
                variant: "destructive",
                title: "خطأ",
                description: "لا يمكن إلغاء الحجز.",
            });
        } finally {
            setPatientToCancel(null);
        }
    }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Users className="text-primary"/> {title}
        </CardTitle>
        <CardDescription>
          عرض مباشر للمرضى الذين ينتظرون الاستشارة.
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
                <TableHead className="w-[80px]">رقم الكشف</TableHead>
                <TableHead>الاسم</TableHead>
                {showDoctorColumn && <TableHead>الطبيب</TableHead>}
                <TableHead>وقت الانتظار المقدر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                    <TableRow key={patient.id} className={patient.status === 'Finished' ? 'opacity-50' : ''}>
                        <TableCell className="font-bold text-lg">{patient.queueNumber}</TableCell>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        {showDoctorColumn && (
                            <TableCell className="text-sm text-muted-foreground">
                                {getDoctorName ? getDoctorName(patient.doctorId || '') : '-'}
                            </TableCell>
                        )}
                        <TableCell>
                            {patient.status === 'Waiting' ? (
                                <span className="font-mono tabular-nums">
                                    {formatWaitTime(calculateWaitTime(patient.queueNumber))}
                                </span>
                            ) : patient.status === 'Consulting' ? (
                                <span className="text-green-600 font-semibold">جاري الكشف الآن</span>
                            ) : patient.status === 'Finished' && patient.consultingStartTime && patient.finishedAt ? (
                                <span className="text-muted-foreground text-sm">
                                    استغرق {formatWaitTime(
                                        (((patient.finishedAt as any).toDate?.() || new Date(patient.finishedAt as any)).getTime() -
                                        ((patient.consultingStartTime as any).toDate?.() || new Date(patient.consultingStartTime as any)).getTime()) / (1000 * 60)
                                    )}
                                </span>
                            ) : '-'}
                        </TableCell>
                        <TableCell>
                            <Badge variant={getStatusBadgeVariant(patient.status)}>{translateStatus(patient.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-left space-x-2">
                            {patient.status === 'Waiting' && (
                                <Button variant="outline" size="sm" onClick={() => handleStartConsultation(patient)} disabled={isDoctorBusy}>
                                    <PlayCircle className="ml-2 h-4 w-4" />
                                    بدء
                                </Button>
                            )}
                            {patient.status === 'Consulting' && (
                                <Button variant="default" size="sm" onClick={() => handleFinishConsultation(patient)} className="bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="ml-2 h-4 w-4" />
                                    إنهاء الكشف
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => onShowQrCode(patient)}>
                                <QrCode className="ml-2 h-4 w-4" />
                                QR
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setPatientToCancel(patient)}>
                                <Trash2 className="ml-2 h-4 w-4" />
                                إلغاء
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={showDoctorColumn ? 6 : 5} className="text-center text-muted-foreground">
                            {searchQuery ? "لا يوجد مرضى يطابقون بحثك." : "لا يوجد مرضى في قائمة الانتظار بعد."}
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
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
                سيؤدي هذا إلى إلغاء الحجز لـ {patientToCancel?.name} بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelReservation} className="bg-destructive hover:bg-destructive/90">
                نعم، قم بإلغاء الحجز
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
