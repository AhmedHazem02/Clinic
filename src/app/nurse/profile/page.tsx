import { NurseProfileForm } from "@/components/nurse/nurse-profile-form";

export default function NurseProfilePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Your Profile</h1>
                <p className="text-muted-foreground">View and edit your personal information.</p>
            </div>
            <NurseProfileForm />
        </div>
    );
}
