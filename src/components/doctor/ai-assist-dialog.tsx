"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAiPrescriptionSuggestions } from "@/app/actions";
import type { AiAssistedPrescriptionInput } from "@/ai/flows/ai-assisted-prescription";
import { useToast } from "@/hooks/use-toast";
import { Bot, Lightbulb } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface AiAssistDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  patient: {
    name: string;
    details: string;
  };
  onInsertSuggestion: (suggestion: string) => void;
}

export function AiAssistDialog({
  isOpen,
  setIsOpen,
  patient,
  onInsertSuggestion,
}: AiAssistDialogProps) {
  const [desiredEffect, setDesiredEffect] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuggestions([]);

    const input: AiAssistedPrescriptionInput = {
      patientName: patient.name,
      patientDetails: patient.details,
      desiredEffect: desiredEffect,
    };

    try {
      const result = await getAiPrescriptionSuggestions(input);
      setSuggestions(result.prescriptionPhrases);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not generate AI suggestions. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2"><Bot /> AI Prescription Assist</DialogTitle>
          <DialogDescription>
            Describe the desired effect, and AI will suggest phrasing for you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="patient-name" className="text-right">
                Patient
              </Label>
              <Input
                id="patient-name"
                value={patient.name}
                disabled
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="desired-effect" className="text-right">
                Effect
              </Label>
              <Textarea
                id="desired-effect"
                placeholder="e.g., relieve pain and reduce inflammation"
                value={desiredEffect}
                onChange={(e) => setDesiredEffect(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !desiredEffect.trim()}>
              {isLoading ? "Generating..." : "Generate Suggestions"}
            </Button>
          </DialogFooter>
        </form>
        
        {isLoading && (
            <div className="mt-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2"><Lightbulb className="text-yellow-400" /> Suggestions</h4>
            {suggestions.map((s, index) => (
              <div
                key={index}
                className="p-3 border rounded-md text-sm hover:bg-secondary cursor-pointer"
                onClick={() => onInsertSuggestion(s)}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
