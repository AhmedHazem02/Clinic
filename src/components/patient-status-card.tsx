
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Clock, HeartPulse, Hash, Users } from "lucide-react";
import { Separator } from "./ui/separator";
import { type PatientInQueue, listenToClinicSettings } from "@/services/queueService";
import { useEffect, useState } from "react";

const DEFAULT_CONSULTATION_TIME = 15; // in minutes

interface PatientStatusCardProps {
  data: PatientInQueue;
  peopleAhead: number;
  isDoctorAvailable: boolean;
}

export function PatientStatusCard({ data, peopleAhead, isDoctorAvailable }: PatientStatusCardProps) {
  const [consultationTime, setConsultationTime] = useState(DEFAULT_CONSULTATION_TIME);
  const [estimatedTimeInSeconds, setEstimatedTimeInSeconds] = useState(0);
  
  useEffect(() => {
    const unsubscribe = listenToClinicSettings((settings) => {
      if (settings) {
        setConsultationTime(settings.consultationTime);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const totalSeconds = peopleAhead * consultationTime * 60;
    setEstimatedTimeInSeconds(totalSeconds);
  }, [peopleAhead, consultationTime]);

  useEffect(() => {
    if (estimatedTimeInSeconds <= 0 || !isDoctorAvailable) return;

    const timer = setInterval(() => {
      setEstimatedTimeInSeconds(prevTime => prevTime > 0 ? prevTime - 1 : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, [estimatedTimeInSeconds, isDoctorAvailable]);


  const formatTime = (totalSeconds: number) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }


  return (
    <Card className="w-full animate-in fade-in-50 duration-500">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-3">
          <User className="text-primary" />
          <span>{data.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-primary/10 p-4 rounded-lg">
                <Hash className="mx-auto h-6 w-6 text-primary mb-1" />
                <p className="text-sm text-muted-foreground">رقم الانتظار</p>
                <p className="text-3xl font-bold">{data.queueNumber}</p>
            </div>
             <div className="bg-primary/10 p-4 rounded-lg">
                <Users className="mx-auto h-6 w-6 text-primary mb-1" />
                <p className="text-sm text-muted-foreground">الأشخاص في الانتظار</p>
                <p className="text-3xl font-bold">{peopleAhead}</p>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg">
                <Clock className="mx-auto h-6 w-6 text-primary mb-1" />
                <p className="text-sm text-muted-foreground">وقت الانتظار المقدر</p>
                <p className="text-2xl font-bold font-mono tracking-tighter">{formatTime(estimatedTimeInSeconds)}</p>
            </div>
        </div>
        
        <Separator/>

        <div className="space-y-2 text-sm">
            {data.age && <p><strong className="font-medium text-foreground">العمر:</strong> {data.age}</p>}
            <div className="flex items-start">
                <HeartPulse className="h-4 w-4 ml-2 mt-0.5 text-destructive flex-shrink-0" />
                <p><strong className="font-medium text-foreground">الأمراض المزمنة:</strong> {data.chronicDiseases || 'لا يوجد'}</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
