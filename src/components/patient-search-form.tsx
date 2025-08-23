"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Phone } from "lucide-react";
import { Separator } from "./ui/separator";
import { getPatientByPhone } from "@/services/queueService";
import { QrScannerDialog } from "./qr-scanner-dialog";

export function PatientSearchForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const router = useRouter();

  const handleSearch = async (phone: string) => {
    if (!phone.trim()) {
      setError("Please enter a valid phone number.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await getPatientByPhone(phone);
      if (result) {
        router.push(`/status/${phone}`);
      } else {
        setError("No patient found with this phone number for today's queue.");
      }
    } catch (err) {
      console.error("Error searching for patient:", err);
      setError("An error occurred while searching. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(phoneNumber);
  };

  const handleScanSuccess = (result: string) => {
    setPhoneNumber(result);
    setIsScannerOpen(false);
    handleSearch(result);
  };

  return (
    <>
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Find Your Spot</CardTitle>
          <CardDescription>
            Enter your phone number to see your queue status.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g., 1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Searching..." : "Check Status"}
            </Button>
            <div className="my-4 flex items-center">
              <Separator className="flex-1" />
              <span className="mx-4 text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" type="button" onClick={() => setIsScannerOpen(true)}>
              <QrCode className="mr-2 h-4 w-4" />
              Scan QR Code
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

      <QrScannerDialog 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
}
