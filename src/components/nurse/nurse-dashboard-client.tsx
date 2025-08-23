
"use client";

import { useEffect, useMemo, useState } from "react";
import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";
import { QrCodeDialog } from "./qr-code-dialog";
import { listenToQueue, type PatientInQueue, type QueueType } from "@/services/queueService";
import { Input } from "../ui/input";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export function NurseDashboardClient() {
    const [qrCodeData, setQrCodeData] = useState<PatientInQueue | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = listenToQueue((updatedQueue) => {
            setPatients(updatedQueue);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handlePatientRegistered = (patient: PatientInQueue) => {
        setQrCodeData(patient);
    }

    const filterPatients = (queueType: QueueType) => {
        return patients.filter(p => (p.queueType || 'Consultation') === queueType);
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1">
                    <PatientRegistrationForm onPatientRegistered={handlePatientRegistered} />
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name, phone, queue #, or date..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Tabs defaultValue="consultation">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="consultation">Consultation Queue</TabsTrigger>
                            <TabsTrigger value="re-consultation">Re-consultation Queue</TabsTrigger>
                        </TabsList>
                        <TabsContent value="consultation">
                             <QueueList 
                                title="Consultation Queue"
                                allPatients={patients}
                                queuePatients={filterPatients('Consultation')}
                                onShowQrCode={setQrCodeData} 
                                searchQuery={searchQuery}
                                isLoading={isLoading}
                            />
                        </TabsContent>
                        <TabsContent value="re-consultation">
                             <QueueList 
                                title="Re-consultation Queue"
                                allPatients={patients}
                                queuePatients={filterPatients('Re-consultation')}
                                onShowQrCode={setQrCodeData} 
                                searchQuery={searchQuery}
                                isLoading={isLoading}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <QrCodeDialog 
                patient={qrCodeData}
                isOpen={!!qrCodeData}
                onClose={() => setQrCodeData(null)}
            />
        </>
    );
}
