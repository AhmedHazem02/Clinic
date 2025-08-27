
"use client";

import { useEffect, useMemo, useState } from 'react';
import { listenToQueue, type PatientInQueue } from '@/services/queueService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Printer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { PrescriptionViewDialog } from './prescription-view-dialog';
import { useToast } from '@/hooks/use-toast';
import { deletePatientAction } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { PrintablePrescription } from './printable-prescription';
import { useDoctorProfile } from './doctor-profile-provider';

export function PatientHistoryClient() {
    const { profile } = useDoctorProfile();
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<PatientInQueue | null>(null);
    const [patientToDelete, setPatientToDelete] = useState<PatientInQueue | null>(null);
    const [patientToPrint, setPatientToPrint] = useState<PatientInQueue | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = listenToQueue((updatedQueue) => {
            const sortedQueue = updatedQueue.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
            setPatients(sortedQueue);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredPatients = useMemo(() => {
        if (!searchQuery) return patients;
        const searchTerm = searchQuery.toLowerCase();
        return patients.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.phone.includes(searchTerm) ||
            p.queueNumber.toString().includes(searchTerm) ||
            format(p.bookingDate, 'PPP').toLowerCase().includes(searchTerm)
        );
    }, [patients, searchQuery]);

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
    };

    const handleDeletePatient = async () => {
        if (!patientToDelete) return;
        try {
            await deletePatientAction(patientToDelete.id);
            toast({
                title: "تم حذف المريض",
                description: `تم حذف سجل ${patientToDelete.name} بنجاح.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "خطأ",
                description: "لا يمكن حذف المريض. يرجى المحاولة مرة أخرى.",
            });
        } finally {
            setPatientToDelete(null);
        }
    };

    const handlePrint = (patient: PatientInQueue) => {
        if (!patient.prescription?.trim()) {
            toast({
                variant: "destructive",
                title: "لا يمكن الطباعة",
                description: "لا توجد وصفة طبية متاحة لهذا المريض.",
            });
            return;
        }
        setPatientToPrint(patient);
        // Use a timeout to allow the state to update and the component to render before printing
        setTimeout(() => {
            window.print();
            setPatientToPrint(null); // Reset after printing
        }, 100);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>جميع المرضى</CardTitle>
                    <CardDescription>
                        سجل كامل لجميع سجلات المرضى في النظام.
                    </CardDescription>
                    <div className="relative pt-2">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="ابحث عن المرضى..."
                            className="pr-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الاسم</TableHead>
                                    <TableHead>الهاتف</TableHead>
                                    <TableHead>تاريخ الحجز</TableHead>
                                    <TableHead>الحالة</TableHead>
                                    <TableHead className="text-left">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPatients.length > 0 ? (
                                    filteredPatients.map((patient) => (
                                        <TableRow key={patient.id}>
                                            <TableCell className="font-medium">{patient.name}</TableCell>
                                            <TableCell>{patient.phone}</TableCell>
                                            <TableCell>{format(patient.bookingDate, 'PPP')}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(patient.status)}>
                                                    {patient.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left space-x-2">
                                                {patient.prescription && (
                                                    <>
                                                        <Button variant="outline" size="sm" onClick={() => setSelectedPatient(patient)}>
                                                            <FileText className="ml-2 h-4 w-4" />
                                                            عرض
                                                        </Button>
                                                        <Button variant="secondary" size="sm" onClick={() => handlePrint(patient)}>
                                                            <Printer className="ml-2 h-4 w-4" />
                                                            طباعة
                                                        </Button>
                                                    </>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setPatientToDelete(patient)}>
                                                    <Trash2 className="ml-2 h-4 w-4" />
                                                    حذف
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            لم يتم العثور على مرضى.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <PrescriptionViewDialog
                patient={selectedPatient}
                isOpen={!!selectedPatient}
                onClose={() => setSelectedPatient(null)}
                onPrint={() => {
                    if (selectedPatient) {
                        handlePrint(selectedPatient);
                    }
                }}
            />
            <AlertDialog open={!!patientToDelete} onOpenChange={(open) => !open && setPatientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيؤدي هذا إلى حذف سجل المريض {patientToDelete?.name} بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePatient} className="bg-destructive hover:bg-destructive/90">
                            نعم، قم بالحذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {patientToPrint && profile && (
                <PrintablePrescription
                    patient={patientToPrint}
                    doctor={profile}
                    prescription={patientToPrint.prescription || ""}
                />
            )}
        </>
    );
}
