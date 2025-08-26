
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
              // Extract phone number from URL if it's a URL
              let scanResult = result.getText();
              try {
                const url = new URL(scanResult);
                const pathParts = url.pathname.split('/');
                const phone = pathParts[pathParts.length - 1];
                if (phone) {
                  scanResult = phone;
                }
              } catch (e) {
                // Not a URL, use the result as is
              }
              onScanSuccess(scanResult);
            }
            if (err && !(err instanceof NotFoundException)) {
              console.error("QR Scan Error:", err);
              toast({
                variant: "destructive",
                title: "خطأ في المسح",
                description: "حدث خطأ أثناء المسح.",
              });
            }
          });
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'تم رفض الوصول إلى الكاميرا',
          description: 'يرجى تمكين أذونات الكاميرا في إعدادات المتصفح لاستخدام الماسح الضوئي.',
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
          <DialogTitle className="font-headline">مسح رمز الاستجابة السريعة</DialogTitle>
          <DialogDescription>
            وجّه الكاميرا إلى رمز الاستجابة السريعة للعثور على حالتك.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline/>

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="mt-4">
              <CameraOff className="h-4 w-4" />
              <AlertTitle>الوصول إلى الكاميرا مطلوب</AlertTitle>
              <AlertDescription>
                يرجى تمكين أذونات الكاميرا في إعدادات المتصفح لاستخدام ماسح رمز الاستجابة السريعة.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
