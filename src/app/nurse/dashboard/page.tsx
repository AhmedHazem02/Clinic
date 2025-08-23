import { NurseDashboardClient } from "@/components/nurse/nurse-dashboard-client";

export const dynamic = 'force-dynamic';

export default function NurseDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Nurse Panel</h1>
                <p className="text-muted-foreground">Register patients and manage the daily queue.</p>
            </div>
            <NurseDashboardClient />
        </div>
    );
}
