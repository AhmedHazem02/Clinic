import { PatientHistoryClient } from "@/components/doctor/patient-history-client";

export default function DoctorHistoryPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Patient History</h1>
                <p className="text-muted-foreground">View records of all past and present patients.</p>
            </div>
            <PatientHistoryClient />
        </div>
    );
}
