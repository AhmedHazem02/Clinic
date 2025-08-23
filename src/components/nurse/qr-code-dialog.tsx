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
import { QRCodeSVG } from "qrcode.react";
import { type PatientInQueue } from "@/services/queueService";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

interface QrCodeDialogProps {
  patient: PatientInQueue | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QrCodeDialog({ patient, isOpen, onClose }: QrCodeDialogProps) {
  const [statusUrl, setStatusUrl] = useState("");

  useEffect(() => {
    if (patient && typeof window !== "undefined") {
      setStatusUrl(`${window.location.origin}/status/${patient.phone}`);
    }
  }, [patient]);

  if (!patient) return null;

  const handlePrint = () => {
    window.print();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Patient QR Code</DialogTitle>
          <DialogDescription>
            Patient can scan this code to check their queue status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4 gap-4">
            <div className="p-4 bg-white rounded-lg border">
                 {statusUrl && <QRCodeSVG value={statusUrl} size={200} />}
            </div>
          <div className="text-center">
            <p className="font-bold text-lg">{patient.name}</p>
            <p className="text-muted-foreground">Queue #{patient.queueNumber}</p>
          </div>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
            <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto">
                <Printer className="mr-2" />
                Print
            </Button>
          <Button onClick={onClose} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
