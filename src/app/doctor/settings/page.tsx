import { NurseManagement } from "@/components/doctor/nurse-management";
import { SettingsForm } from "@/components/doctor/settings-form";

export default function DoctorSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Settings</h1>
                <p className="text-muted-foreground">Manage your consultation preferences and staff accounts.</p>
            </div>
            <SettingsForm />
            <NurseManagement />
        </div>
    );
}
