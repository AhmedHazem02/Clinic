import { PatientSearchForm } from "@/components/patient-search-form";
import { Stethoscope } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Stethoscope className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-headline text-4xl font-bold text-foreground">
            QueueWise Clinic
          </h1>
          <p className="text-muted-foreground mt-2">
            Check your appointment status below.
          </p>
        </div>
        
        <PatientSearchForm />
        
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Are you a staff member? <a href="/login" className="font-medium text-primary hover:underline">Login here</a></p>
        </div>
      </div>
    </main>
  );
}
