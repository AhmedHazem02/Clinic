import { LoginTabs } from "@/components/login-tabs";
import { Stethoscope } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Stethoscope className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-headline text-4xl font-bold text-foreground">
            QueueWise Clinic
          </h1>
          <p className="text-muted-foreground mt-2">
            Staff Portal Login
          </p>
        </div>
        <LoginTabs />
      </div>
    </div>
  );
}
