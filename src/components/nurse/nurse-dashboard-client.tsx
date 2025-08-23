
"use client";

import { useState } from "react";
import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";
import { QrCodeDialog } from "./qr-code-dialog";
import type { PatientInQueue } from "@/services/queueService";
import { Input } from "../ui/input";
import { Search } from "lucide-react";

export function NurseDashboardClient() {
    const [qrCodeData, setQrCodeData] = useState<PatientInQueue | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const handlePatientRegistered = (patient: PatientInQueue) => {
        setQrCodeData(patient);
    }

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
                    <QueueList 
                        onShowQrCode={setQrCodeData} 
                        searchQuery={searchQuery}
                    />
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
