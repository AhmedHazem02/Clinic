"use client";

import { useEffect, useMemo, useState } from 'react';
import { listenToQueue, type PatientInQueue } from '@/services/queueService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

export function PatientHistoryClient() {
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const unsubscribe = listenToQueue((updatedQueue) => {
            setPatients(updatedQueue);
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
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">All Patients</CardTitle>
                <CardDescription>
                    A complete log of all patient records in the system.
                </CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search patients..."
                        className="pl-10"
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
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Booking Date</TableHead>
                                <TableHead>Queue #</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map((patient) => (
                                    <TableRow key={patient.id}>
                                        <TableCell className="font-medium">{patient.name}</TableCell>
                                        <TableCell>{patient.phone}</TableCell>
                                        <TableCell>{format(patient.bookingDate, 'PPP')}</TableCell>
                                        <TableCell>{patient.queueNumber}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(patient.status)}>
                                                {patient.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No patients found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
