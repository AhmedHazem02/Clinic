import { NurseProfileForm } from "@/components/nurse/nurse-profile-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NurseProfilePage() {
    return (
        <div className="space-y-6">
            <div className="mb-6">
                <Button variant="ghost" asChild>
                    <Link href="/nurse/dashboard">
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <div>
                <h1 className="text-3xl font-bold font-headline">Your Profile</h1>
                <p className="text-muted-foreground">View and edit your personal information.</p>
            </div>
            <NurseProfileForm />
        </div>
    );
}
