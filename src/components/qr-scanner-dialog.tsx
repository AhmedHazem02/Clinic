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
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
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
    if (!isOpen) {
      return;
    }

    const codeReader = new BrowserMultiFormatReader();
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        // Request camera access and get the stream
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        
        // Attach the stream to the video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Start decoding from the video element
          codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
            if (result) {
              onScanSuccess(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              console.error("QR Scan Error:", err);
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
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use the scanner.',
        });
      }
    };

    startScanner();

    // Cleanup function to stop the camera when the component unmounts or dialog closes
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
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
          <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline/>

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
