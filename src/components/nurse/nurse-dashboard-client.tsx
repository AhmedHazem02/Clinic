"use client";

import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";

export function NurseDashboardClient() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1">
                <PatientRegistrationForm />
            </div>
            <div className="lg:col-span-2">
                <QueueList />
            </div>
        </div>
    );
}
