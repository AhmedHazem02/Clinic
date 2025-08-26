
import { NurseDashboardClient } from "@/components/nurse/nurse-dashboard-client";

export const dynamic = 'force-dynamic';

export default function NurseDashboardPage() {
    return (
        <div className="space-y-6">
            <div className="hidden md:block">
                <h1 className="text-3xl font-bold">لوحة الممرضة</h1>
                <p className="text-muted-foreground">تسجيل المرضى وإدارة قائمة الانتظار اليومية.</p>
            </div>
            <NurseDashboardClient />
        </div>
    );
}
