import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Clock, HeartPulse, Hash } from "lucide-react";
import { Separator } from "./ui/separator";

export type PatientData = {
  name: string;
  queueNumber: number;
  estimatedTime: number;
  age: number;
  chronicDiseases: string;
};

interface PatientStatusCardProps {
  data: PatientData;
}

export function PatientStatusCard({ data }: PatientStatusCardProps) {
  return (
    <Card className="w-full animate-in fade-in-50 duration-500">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-3">
          <User className="text-primary" />
          <span>{data.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
            <div className="bg-primary/10 p-4 rounded-lg">
                <Hash className="mx-auto h-6 w-6 text-primary mb-1" />
                <p className="text-sm text-muted-foreground">Queue Number</p>
                <p className="text-3xl font-bold">{data.queueNumber}</p>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg">
                <Clock className="mx-auto h-6 w-6 text-primary mb-1" />
                <p className="text-sm text-muted-foreground">Est. Wait Time</p>
                <p className="text-3xl font-bold">{data.estimatedTime} <span className="text-xl">min</span></p>
            </div>
        </div>
        
        <Separator/>

        <div className="space-y-2 text-sm">
            <p><strong className="font-medium text-foreground">Age:</strong> {data.age}</p>
            <div className="flex items-start">
                <HeartPulse className="h-4 w-4 mr-2 mt-0.5 text-destructive flex-shrink-0" />
                <p><strong className="font-medium text-foreground">Chronic Diseases:</strong> {data.chronicDiseases || 'None'}</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
