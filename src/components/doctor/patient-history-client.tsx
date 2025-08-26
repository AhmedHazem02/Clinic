
"use client";

import { useEffect, useMemo, useState } from 'react';
import { listenToQueue, type PatientInQueue } from '@/services/queueService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { PrescriptionViewDialog } from './prescription-view-dialog';

export function PatientHistoryClient() {
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<PatientInQueue | null>(null);

    useEffect(() => {
        const unsubscribe = listenToQueue((updatedQueue) => {
            // Sort by booking date, most recent first
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
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">جميع المرضى</CardTitle>
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
                                            <TableCell className="text-left">
                                                {patient.prescription && (
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedPatient(patient)}>
                                                        <FileText className="ml-2 h-4 w-4" />
                                                        عرض الوصفة
                                                    </Button>
                                                )}
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
            />
        </>
    );
}
