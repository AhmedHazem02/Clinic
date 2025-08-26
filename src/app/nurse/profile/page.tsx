
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
                        <ArrowLeft className="ml-2" />
                        العودة إلى لوحة التحكم
                    </Link>
                </Button>
            </div>
            <div>
                <h1 className="text-3xl font-bold font-headline">ملفك الشخصي</h1>
                <p className="text-muted-foreground">عرض وتعديل معلوماتك الشخصية.</p>
            </div>
            <NurseProfileForm />
        </div>
    );
}
