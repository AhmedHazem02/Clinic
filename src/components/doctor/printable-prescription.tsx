
"use client";

import { type PatientInQueue, type DoctorProfile } from "@/services/queueService";
import { format } from "date-fns";

interface PrintablePrescriptionProps {
    patient: PatientInQueue;
    doctor: DoctorProfile;
    prescription: string;
}

export function PrintablePrescription({ patient, doctor, prescription }: PrintablePrescriptionProps) {
    return (
        <div id="printable-prescription" className="p-8 font-sans text-black">
            <div className="space-y-1 mb-6">
                <h2 className="text-xl font-bold mb-4">Patient Information</h2>
                <p><strong>Name:</strong> {patient.name}</p>
                <p><strong>Phone:</strong> {patient.phone}</p>
                <p><strong>Age:</strong> {patient.age || "N/A"}</p>
                <p><strong>Date:</strong> {format(new Date(), "PPP")}</p>
            </div>
            
            <hr className="my-6 border-black" />
            
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Prescription (Rx)</h2>
                <div className="whitespace-pre-wrap">{prescription}</div>
            </div>

            <hr className="my-6 border-black" />

            <div className="space-y-1 text-sm">
                 <h2 className="text-xl font-bold mb-4">Doctor Information</h2>
                 <p><strong>Dr.</strong> {doctor.name}</p>
                 <p><strong>Phone:</strong> {doctor.clinicPhoneNumber}</p>
                 <p><strong>Location(s):</strong> {doctor.locations.join(", ")}</p>
            </div>
        </div>
    );
}
