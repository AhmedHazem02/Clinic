import { NurseManagement } from "@/components/doctor/nurse-management";
import { ProfileForm } from "@/components/doctor/profile-form";

export default function DoctorProfilePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Your Profile</h1>
                <p className="text-muted-foreground">View and edit your personal and clinic information.</p>
            </div>
            <ProfileForm />
            <NurseManagement />
        </div>
    );
}
