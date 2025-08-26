
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
        <div id="printable-prescription" className="p-8 font-sans text-black" dir="rtl">
            <div className="space-y-1 mb-6">
                <h2 className="text-xl font-bold mb-4">معلومات المريض</h2>
                <p><strong>الاسم:</strong> {patient.name}</p>
                <p><strong>الهاتف:</strong> {patient.phone}</p>
                <p><strong>العمر:</strong> {patient.age || "غير متوفر"}</p>
                <p><strong>التاريخ:</strong> {format(new Date(), "PPP")}</p>
            </div>
            
            <hr className="my-6 border-black" />
            
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">الوصفة الطبية (Rx)</h2>
                <div className="whitespace-pre-wrap">{prescription}</div>
            </div>

            <hr className="my-6 border-black" />

            <div className="space-y-1 text-sm">
                 <h2 className="text-xl font-bold mb-4">معلومات الطبيب</h2>
                 <p><strong>د.</strong> {doctor.name}</p>
                 <p><strong>الهاتف:</strong> {doctor.clinicPhoneNumber}</p>
                 <p><strong>الموقع (المواقع):</strong> {(doctor.locations || []).join(", ")}</p>
            </div>
        </div>
    );
}
