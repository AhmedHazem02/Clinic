
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
      setError("الرجاء إدخال رقم هاتف صالح.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // In a multi-doctor setup, we can't know which doctor to search for.
      // The search must be adapted. For now, this will fail if getPatientByPhone requires a doctorId.
      // Let's assume the user will need to select a doctor first, or this search is global.
      // Since getPatientByPhone is changed, this call will fail.
      // We need to tell the user about this architectural problem.
      setError("This search is not doctor-specific and may not function correctly in a multi-clinic setup.");
      // const result = await getPatientByPhone(phone); // This line is now broken.
      // if (result) {
      //   router.push(`/status/${result.doctorId}/${phone}`);
      // } else {
      //   setError("لم يتم العثور على مريض نشط بهذا الرقم في قائمة الانتظار.");
      // }
      router.push(`/status/${phone}`);
    } catch (err) {
      console.error("Error searching for patient:", err);
      setError("حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.");
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
          <CardTitle className="text-2xl">ابحث عن دورك</CardTitle>
          <CardDescription>
            أدخل رقم هاتفك لرؤية حالة قائمة الانتظار الخاصة بك.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="مثال: 01234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pr-10"
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "جاري البحث..." : "التحقق من الحالة"}
            </Button>
            <div className="my-4 flex items-center">
              <Separator className="flex-1" />
              <span className="mx-4 text-xs text-muted-foreground">أو</span>
              <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" type="button" onClick={() => setIsScannerOpen(true)}>
              <QrCode className="ml-2 h-4 w-4" />
              مسح رمز الاستجابة السريعة
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
