
import { DoctorDashboardClient } from "@/components/doctor/doctor-dashboard-client";
 

export const dynamic = 'force-dynamic';

export default function DoctorDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">لوحة تحكم الطبيب</h1>
                <p className="text-muted-foreground">قم بإدارة استشاراتك ووصفاتك الطبية.</p>
            </div>
            <DoctorDashboardClient />
        </div>
    );
}
