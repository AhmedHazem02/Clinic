"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect, useRef } from "react";
import { CameraOff } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/browser';
import { useToast } from "@/hooks/use-toast";

interface QrScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (result: string) => void;
}

export function QrScannerDialog({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerDialogProps) {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const codeReader = new BrowserMultiFormatReader();
    let selectedDeviceId: string;

    const startScanner = async () => {
        try {
            const videoInputDevices = await codeReader.listVideoInputDevices();
            if (videoInputDevices.length === 0) {
                setHasCameraPermission(false);
                return;
            }
            setHasCameraPermission(true);
            selectedDeviceId = videoInputDevices[0].deviceId;
            
            if (videoRef.current) {
                 const controls = await codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (result, err) => {
                    if (result) {
                        onScanSuccess(result.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.error(err);
                        toast({
                            variant: "destructive",
                            title: "Scan Error",
                            description: "An error occurred while scanning.",
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
        }
    };

    startScanner();

    return () => {
      codeReader.reset();
    };
  }, [isOpen, onScanSuccess, toast]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">Scan QR Code</DialogTitle>
          <DialogDescription>
            Point your camera at the QR code to find your status.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <video ref={videoRef} className="w-full aspect-video rounded-md" />

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="mt-4">
              <CameraOff className="h-4 w-4" />
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please enable camera permissions in your browser settings to use the QR scanner.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
