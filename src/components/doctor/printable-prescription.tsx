
"use client";

import { type PatientInQueue, type DoctorProfile } from "@/services/queueService";
import { format } from "date-fns";
import { useEffect, useState } from "react";

interface PrintablePrescriptionProps {
    patient: PatientInQueue;
    doctor: DoctorProfile;
    prescription: string;
}

export function PrintablePrescription({ patient, doctor, prescription }: PrintablePrescriptionProps) {
    const [currentUrl, setCurrentUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setCurrentUrl(window.location.href);
        }
    }, []);

    return (
        <div id="printable-prescription" className="p-8 font-sans text-black bg-white" dir="rtl">
            <div className="min-h-[90vh] flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-center pb-4 border-b border-gray-300">
                    <div className="text-sm text-gray-600">
                        {format(new Date(), "M/d/yy, h:mm a")}
                    </div>
                    <div className="font-bold text-lg">
                        عيادة د/ {doctor.name}
                    </div>
                </header>

                <main className="flex-grow pt-10">
                    {/* Patient Info */}
                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">معلومات المريض</h2>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-md">
                            <p><strong>الاسم:</strong> {patient.name}</p>
                            <p><strong>الهاتف:</strong> {patient.phone}</p>
                            <p><strong>العمر:</strong> {patient.age || "غير متوفر"}</p>
                            <p><strong>التاريخ:</strong> {format(patient.bookingDate, "PPP")}</p>
                        </div>
                    </section>

                    <hr className="my-8 border-gray-400" />

                    {/* Prescription */}
                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">الوصفة الطبية (Rx)</h2>
                        <div className="mt-4 whitespace-pre-wrap text-md p-2 min-h-[100px]">
                            {prescription}
                        </div>
                    </section>

                     <hr className="my-8 border-gray-400" />

                    {/* Doctor Info */}
                    <section>
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">معلومات الطبيب</h2>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-md">
                            <p><strong>د.</strong> {doctor.name}</p>
                            <p><strong>الهاتف:</strong> {(doctor.clinicPhoneNumbers || []).join(" / ")}</p>
                            <p><strong>الموقع (المواقع):</strong> {(doctor.locations || []).join(" / ")}</p>
                        </div>
                    </section>
                </main>

                {/* Footer */}
                <footer className="text-center text-xs text-gray-500 pt-8 mt-auto border-t">
                   <p>{currentUrl}</p>
                   <p>1/1</p>
                </footer>
            </div>
        </div>
    );
}
