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
import { Badge } from "@/components/ui/badge";
import { Users } from 'lucide-react';

type Patient = {
    queueNumber: number;
    name: string;
    phone: string;
    status: 'Waiting' | 'Consulting' | 'Finished';
};

interface QueueListProps {
    initialPatients: Patient[];
}

const CONSULTATION_TIME = 15; // in minutes

export function QueueList({ initialPatients }: QueueListProps) {
    const [patients, setPatients] = useState(initialPatients);
    
    // Simulate real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            // This is a mock update. In a real app, this would be handled by a Firestore listener.
            // For example, moving the next patient to 'Consulting'.
        }, 30000); // update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const calculateWaitTime = (queueNumber: number) => {
        const consultingPatient = patients.find(p => p.status === 'Consulting');
        if (!consultingPatient) return 0;

        const patientsAhead = queueNumber - consultingPatient.queueNumber - 1;
        if (patientsAhead < 0) return 0; // Already consulting or finished
        
        return (patientsAhead + 1) * CONSULTATION_TIME;
    }

    const getStatusBadgeVariant = (status: Patient['status']) => {
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
        <CardTitle className="font-headline flex items-center gap-2">
            <Users className="text-primary"/> Today's Queue
        </CardTitle>
        <CardDescription>
          Live view of patients waiting for consultation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Queue #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Est. Wait</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.filter(p => p.status !== 'Finished').map((patient) => (
              <TableRow key={patient.queueNumber}>
                <TableCell className="font-bold text-lg">{patient.queueNumber}</TableCell>
                <TableCell className="font-medium">{patient.name}</TableCell>
                <TableCell>{patient.status === 'Waiting' ? `${calculateWaitTime(patient.queueNumber)} min` : '-'}</TableCell>
                <TableCell className="text-right">
                    <Badge variant={getStatusBadgeVariant(patient.status)}>{patient.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
