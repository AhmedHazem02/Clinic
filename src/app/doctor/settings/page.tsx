
import { SettingsForm } from "@/components/doctor/settings-form";

export default function DoctorSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">الإعدادات</h1>
                <p className="text-muted-foreground">إدارة تفضيلات الاستشارة وحسابات الموظفين.</p>
            </div>
            <SettingsForm />
        </div>
    );
}
