
import { PatientHistoryClient } from "@/components/doctor/patient-history-client";

export default function DoctorHistoryPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">سجل المرضى</h1>
                <p className="text-muted-foreground">عرض سجلات جميع المرضى السابقين والحاليين.</p>
            </div>
            <PatientHistoryClient />
        </div>
    );
}
