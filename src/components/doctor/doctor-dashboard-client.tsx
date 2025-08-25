
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Bot, Send, Printer, User, HeartPulse, LogIn, CheckCircle, MessageSquarePlus, DollarSign, Info, Settings, FileText } from "lucide-react";
import { AiAssistDialog } from "./ai-assist-dialog";
import { useToast } from "@/hooks/use-toast";
import { listenToQueue, type PatientInQueue, finishAndCallNext, updatePatientStatus, updateDoctorMessage, listenToDoctorMessage, listenToClinicSettings, getDoctorProfile } from "@/services/queueService";
import { Skeleton } from "../ui/skeleton";
import { useDoctorProfile } from "./doctor-profile-provider";
import { setDoctorAvailability } from "@/app/actions";

const DEFAULT_CONSULTATION_COST = 50;
const DEFAULT_RECONSULTATION_COST = 25;

export function DoctorDashboardClient() {
  const { user } = useDoctorProfile();
  const [isAvailable, setIsAvailable] = useState(true);
  const [prescription, setPrescription] = useState("");
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const { toast } = useToast();

  const [queue, setQueue] = useState<PatientInQueue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [todaysRevenue, setTodaysRevenue] = useState(0);
  const [consultationCost, setConsultationCost] = useState(DEFAULT_CONSULTATION_COST);
  const [reConsultationCost, setReConsultationCost] = useState(DEFAULT_RECONSULTATION_COST);

  useEffect(() => {
     const unsubscribeSettings = listenToClinicSettings((settings) => {
      if (settings) {
        setConsultationCost(settings.consultationCost);
        setReConsultationCost(settings.reConsultationCost);
      }
    });

    const unsubscribeQueue = listenToQueue((updatedQueue) => {
      setQueue(updatedQueue);
      setIsLoading(false);
    });
    
    const unsubscribeMessage = listenToDoctorMessage((message) => {
      setDoctorMessage(message);
    });
    
    // Fetch initial availability state
    if (user) {
        getDoctorProfile(user.uid).then(profile => {
            if (profile) {
                setIsAvailable(profile.isAvailable ?? true);
            }
        });
    }


    return () => {
      unsubscribeQueue();
      unsubscribeMessage();
      unsubscribeSettings();
    };
  }, [user]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysFinishedPatients = queue.filter(p => {
        if (!p.bookingDate) return false;
        const bookingDate = new Date(p.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return p.status === 'Finished' && bookingDate.getTime() === today.getTime();
    });

    const totalRevenue = todaysFinishedPatients.reduce((total, patient) => {
        const cost = patient.queueType === 'Re-consultation' ? reConsultationCost : consultationCost;
        return total + cost;
    }, 0);

    setTodaysRevenue(totalRevenue);
  }, [queue, consultationCost, reConsultationCost]);

  const handleAvailabilityChange = async (checked: boolean) => {
      if (!user) return;
      setIsAvailable(checked);
      try {
          await setDoctorAvailability(user.uid, checked);
          if (checked) {
              // If doctor is now available, clear the message
              setDoctorMessage("");
              await updateDoctorMessage("");
          }
      } catch (error) {
           toast({ variant: "destructive", title: "Error", description: "Could not update availability status." });
           // Revert state on error
           setIsAvailable(!checked);
      }
  }


  const currentPatient = queue.find(p => p.status === 'Consulting');
  const nextPatient = queue.find(p => p.status === 'Waiting');

  const handleCallNext = async () => {
    if (!nextPatient) {
        toast({ variant: "destructive", title: "No patients are waiting." });
        return;
    }
    try {
        if (currentPatient) {
            await finishAndCallNext(currentPatient.id, nextPatient.id);
        } else {
            await updatePatientStatus(nextPatient.id, 'Consulting');
        }
        setPrescription(""); 
        toast({ title: "Success", description: `Calling ${nextPatient.name} for consultation.` });
    } catch (error) {
        console.error("Error calling next patient:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not call the next patient." });
    }
  }

  const handleFinishConsultation = async () => {
      if (!currentPatient) return;
      try {
        await updatePatientStatus(currentPatient.id, 'Finished');
        setPrescription("");
        toast({ title: "Consultation Finished", description: `${currentPatient.name}'s consultation is complete.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not finish the consultation." });
      }
  }

  const handleSendToWhatsApp = () => {
    if (!currentPatient) return;
    toast({
      title: "Prescription Sent",
      description: `Prescription has been sent to ${currentPatient.name} via WhatsApp.`,
    });
  }

  const handlePrint = () => {
    if (!currentPatient) return;
    toast({
        title: "Printing Prescription",
        description: `Your prescription for ${currentPatient.name} is being printed.`,
      });
  }
  
  const handleUpdateMessage = async () => {
    setIsUpdatingMessage(true);
    try {
      await updateDoctorMessage(doctorMessage);
      toast({
        title: "Message Updated",
        description: "Your message has been updated for all patients.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update the message.",
      });
    } finally {
      setIsUpdatingMessage(false);
    }
  };

  const isNewAccount = !isLoading && queue.length === 0;

  return (
    <>
      {isNewAccount && (
        <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-headline">Welcome to QueueWise!</AlertTitle>
            <AlertDescription>
                <p>It looks like this is your first time here. To get started, please set your average consultation time and cost.</p>
                <Button asChild variant="link" className="p-0 h-auto mt-2">
                    <Link href="/doctor/settings">
                        <Settings className="mr-2" /> Go to Settings
                    </Link>
                </Button>
            </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <User className="text-primary"/> Current Patient
                </CardTitle>
                <CardDescription>
                    {currentPatient ? "Patient waiting for consultation." : "No patient is currently in consultation."}
                </CardDescription>
            </CardHeader>
            {isLoading ? (
                <CardContent className="space-y-2">
                    <Skeleton className="h-7 w-1/2" />
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                </CardContent>
            ) : currentPatient ? (
                <CardContent className="space-y-2">
                    <h3 className="text-xl font-bold">{currentPatient.name}</h3>
                    <p className="text-sm"><strong className="font-medium">Age:</strong> {currentPatient.age || 'N/A'}</p>
                     <p className="text-sm flex items-start">
                        <FileText className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0"/> 
                        <strong className="font-medium">Reason:</strong> {currentPatient.consultationReason || 'N/A'}
                    </p>
                    <p className="text-sm flex items-start">
                        <HeartPulse className="h-4 w-4 mr-2 mt-0.5 text-destructive flex-shrink-0"/> 
                        <strong className="font-medium">Chronic Diseases:</strong> {currentPatient.chronicDiseases || 'None'}
                    </p>
                </CardContent>
            ) : (
                <CardContent>
                    <p className="text-muted-foreground">Waiting to call the next patient.</p>
                </CardContent>
            )}
            <CardFooter>
                {currentPatient ? (
                    <div className="flex gap-2">
                        <Button onClick={handleFinishConsultation} variant="outline">
                            <CheckCircle /> Finish Consultation
                        </Button>
                        <Button onClick={handleCallNext} disabled={!nextPatient}>
                            <LogIn /> Finish & Call Next
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleCallNext} disabled={!nextPatient || !isAvailable}>
                        <LogIn /> Call Next Patient
                    </Button>
                )}
            </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Create Prescription</CardTitle>
                <CardDescription>
                  {currentPatient ? `Write a prescription for ${currentPatient.name}. Use AI assist for suggestions.` : "No active patient."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Take one tablet of Paracetamol 500mg..."
                  className="min-h-[150px]"
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  disabled={!currentPatient}
                />
                <Button variant="outline" onClick={() => setIsAiDialogOpen(true)} disabled={!currentPatient}>
                  <Bot className="mr-2" />
                  AI Assist
                </Button>
              </CardContent>
              <CardFooter className="gap-2 justify-end">
                <Button variant="secondary" onClick={handlePrint} disabled={!currentPatient || !prescription.trim()}>
                  <Printer className="mr-2" /> Print
                </Button>
                <Button onClick={handleSendToWhatsApp} disabled={!currentPatient || !prescription.trim()}>
                  <Send className="mr-2" /> Send to WhatsApp
                </Button>
              </CardFooter>
            </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
            <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                <CardTitle className="font-headline">Your Status</CardTitle>
                <CardDescription>Set your availability.</CardDescription>
                </div>
                <Switch
                checked={isAvailable}
                onCheckedChange={handleAvailabilityChange}
                aria-label="Doctor availability status"
                />
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className={`text-lg font-semibold ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {isAvailable ? "Available for Consultation" : "Not Available"}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="doctor-message">Patient Message</Label>
                    <Textarea 
                        id="doctor-message"
                        placeholder="e.g., Running 15 minutes late."
                        value={doctorMessage}
                        onChange={(e) => setDoctorMessage(e.target.value)}
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleUpdateMessage} disabled={isUpdatingMessage}>
                <MessageSquarePlus /> {isUpdatingMessage ? 'Updating...' : 'Update Message'}
                </Button>
            </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <DollarSign className="text-primary"/> Today's Revenue
                    </CardTitle>
                    <CardDescription>Total earnings from finished consultations today.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Skeleton className="h-10 w-24" />
                    ) : (
                        <p className="text-3xl font-bold">
                            ${todaysRevenue.toFixed(2)}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Patient Data</CardTitle>
                    <CardDescription>Download patient data report.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full">
                        <Download className="mr-2" /> Download 30-Day Report
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
       {currentPatient && (
            <AiAssistDialog
                isOpen={isAiDialogOpen}
                setIsOpen={setIsAiDialogOpen}
                patient={{ name: currentPatient.name, details: `Age: ${currentPatient.age}, Chronic Diseases: ${currentPatient.chronicDiseases || 'None'}` }}
                onInsertSuggestion={(text) => {
                    setPrescription(prev => prev ? `${prev}\n${text}` : text);
                    setIsAiDialogOpen(false);
                }}
            />
       )}
    </>
  );
}
