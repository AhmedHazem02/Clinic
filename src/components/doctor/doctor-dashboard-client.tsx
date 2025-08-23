"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Bot, Send, Printer, User, HeartPulse } from "lucide-react";
import { AiAssistDialog } from "./ai-assist-dialog";
import { useToast } from "@/hooks/use-toast";

const currentPatient = {
  name: "John Doe",
  age: 34,
  chronicDiseases: "Hypertension",
  details: "Patient reports chest pain and shortness of breath. History of high blood pressure, non-smoker."
};

export function DoctorDashboardClient() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [prescription, setPrescription] = useState("");
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSendToWhatsApp = () => {
    toast({
      title: "Prescription Sent",
      description: `Prescription has been sent to ${currentPatient.name} via WhatsApp.`,
    });
  }

  const handlePrint = () => {
    toast({
        title: "Printing Prescription",
        description: `Your prescription for ${currentPatient.name} is being printed.`,
      });
  }


  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-headline">Your Status</CardTitle>
            <Switch
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
              aria-label="Doctor availability status"
            />
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
              {isAvailable ? "Available for Consultation" : "Not Available"}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <User className="text-primary"/> Current Patient
            </CardTitle>
            <CardDescription>Patient waiting for consultation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <h3 className="text-xl font-bold">{currentPatient.name}</h3>
            <p className="text-sm"><strong className="font-medium">Age:</strong> {currentPatient.age}</p>
            <p className="text-sm flex items-start">
                <HeartPulse className="h-4 w-4 mr-2 mt-0.5 text-destructive flex-shrink-0"/> 
                <strong className="font-medium">Chronic Diseases:</strong> {currentPatient.chronicDiseases}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-headline">Create Prescription</CardTitle>
            <CardDescription>
              Write a prescription for {currentPatient.name}. Use AI assist for suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Take one tablet of Paracetamol 500mg..."
              className="min-h-[150px]"
              value={prescription}
              onChange={(e) => setPrescription(e.target.value)}
            />
            <Button variant="outline" onClick={() => setIsAiDialogOpen(true)}>
              <Bot className="mr-2" />
              AI Assist
            </Button>
          </CardContent>
          <CardFooter className="gap-2 justify-end">
            <Button variant="secondary" onClick={handlePrint}>
              <Printer className="mr-2" /> Print
            </Button>
            <Button onClick={handleSendToWhatsApp}>
              <Send className="mr-2" /> Send to WhatsApp
            </Button>
          </CardFooter>
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
      <AiAssistDialog
        isOpen={isAiDialogOpen}
        setIsOpen={setIsAiDialogOpen}
        patient={currentPatient}
        onInsertSuggestion={(text) => {
            setPrescription(prev => prev ? `${prev}\n${text}` : text);
            setIsAiDialogOpen(false);
        }}
      />
    </>
  );
}
