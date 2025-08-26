
import { ProfileForm } from "@/components/doctor/profile-form";

export default function DoctorProfilePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">ملفك الشخصي</h1>
                <p className="text-muted-foreground">عرض وتعديل معلوماتك الشخصية ومعلومات العيادة.</p>
            </div>
            <ProfileForm />
        </div>
    );
}
