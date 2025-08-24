import { OnboardingForm } from "@/components/doctor/onboarding-form";

export default function OnboardingPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl mx-auto space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold font-headline">Welcome, Doctor!</h1>
                    <p className="text-muted-foreground">Let's set up your profile to get started.</p>
                </div>
                <OnboardingForm />
            </div>
        </div>
    );
}
