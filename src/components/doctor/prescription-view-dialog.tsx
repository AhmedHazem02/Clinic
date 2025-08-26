
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type PatientInQueue } from "@/services/queueService";
import { format } from "date-fns";
import { FileText } from "lucide-react";

interface PrescriptionViewDialogProps {
  patient: PatientInQueue | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrescriptionViewDialog({ patient, isOpen, onClose }: PrescriptionViewDialogProps) {
  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <FileText /> تفاصيل الوصفة الطبية
          </DialogTitle>
          <DialogDescription>
            وصفة طبية لـ {patient.name} في {format(patient.bookingDate, "PPP")}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div>
                <h4 className="font-semibold">معلومات المريض</h4>
                <p className="text-sm"><strong>الاسم:</strong> {patient.name}</p>
                <p className="text-sm"><strong>العمر:</strong> {patient.age || "غير متوفر"}</p>
                <p className="text-sm"><strong>الهاتف:</strong> {patient.phone}</p>
            </div>
            <hr />
            <div>
                <h4 className="font-semibold">الوصفة الطبية (Rx)</h4>
                <div className="mt-2 p-3 border rounded-md text-sm whitespace-pre-wrap bg-secondary/50">
                    {patient.prescription}
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
