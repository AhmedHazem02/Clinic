"use client";

import { useState } from "react";
import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";
import { QrCodeDialog } from "./qr-code-dialog";
import type { PatientInQueue } from "@/services/queueService";

export function NurseDashboardClient() {
    const [qrCodeData, setQrCodeData] = useState<PatientInQueue | null>(null);

    const handlePatientRegistered = (patient: PatientInQueue) => {
        setQrCodeData(patient);
    }

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1">
                    <PatientRegistrationForm onPatientRegistered={handlePatientRegistered} />
                </div>
                <div className="lg:col-span-2">
                    <QueueList />
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
