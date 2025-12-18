"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, QrCode as QrCodeIcon, Copy, Home } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getBookingTicket } from "@/services/bookingTicketService";
import { getClinicById, getDoctorById } from "@/services/clinicPublicService";
import { BookingTicket } from "@/types/multitenant";
import { Clinic, Doctor } from "@/types/multitenant";
import { toast } from "@/hooks/use-toast";

function BookingSuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clinicSlug = params.clinicSlug as string;
  const ticketId = searchParams.get("ticketId");

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<BookingTicket | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [statusUrl, setStatusUrl] = useState("");

  useEffect(() => {
    async function loadBookingData() {
      if (!ticketId) {
        toast({
          title: "خطأ",
          description: "معرف الحجز غير موجود",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      try {
        // Fetch booking ticket
        const ticketData = await getBookingTicket(ticketId);
        if (!ticketData) {
          toast({
            title: "خطأ",
            description: "لم يتم العثور على الحجز",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setTicket(ticketData);

        // Fetch clinic and doctor info
        const [clinicData, doctorData] = await Promise.all([
          getClinicById(ticketData.clinicId),
          getDoctorById(ticketData.doctorId),
        ]);

        setClinic(clinicData);
        setDoctor(doctorData);

        // Build status URL
        const url = `${window.location.origin}/status/${ticketData.clinicId}/${ticketData.doctorId}/${ticketId}`;
        setStatusUrl(url);
      } catch (err) {
        console.error("Error loading booking data:", err);
        toast({
          title: "خطأ",
          description: "حدث خطأ في تحميل بيانات الحجز",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadBookingData();
  }, [ticketId]);

  const handleCopyUrl = () => {
    if (statusUrl) {
      navigator.clipboard.writeText(statusUrl);
      toast({
        title: "تم النسخ",
        description: "تم نسخ رابط الحالة إلى الحافظة",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">جاري تحميل بيانات الحجز...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (ticket && clinic && doctor) {
    const estimatedWaitTime = ticket.queueNumber * (clinic.settings?.consultationTime || 15);

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Header */}
          <Card className="text-center border-green-500">
            <CardHeader className="pb-4">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl text-green-700">
                تم الحجز بنجاح!
              </CardTitle>
              <CardDescription>
                تم إضافتك إلى قائمة الانتظار
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الحجز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">رقم الكشف</p>
                  <p className="text-2xl font-bold text-blue-600">#{ticket.queueNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">الحالة</p>
                  <p className="text-lg font-semibold text-orange-600">
                    {ticket.status === "Waiting" && "في الانتظار"}
                    {ticket.status === "Consulting" && "جاري الكشف"}
                    {ticket.status === "Finished" && "انتهى"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">العيادة:</span>
                    <span className="font-semibold">{clinic.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الطبيب:</span>
                    <span className="font-semibold">{doctor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">التخصص:</span>
                    <span className="font-semibold">{doctor.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الوقت المتوقع:</span>
                    <span className="font-semibold">
                      {estimatedWaitTime > 0 
                        ? `حوالي ${estimatedWaitTime} دقيقة`
                        : "قريباً"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Card */}
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5" />
                رمز الاستجابة السريعة (QR)
              </CardTitle>
              <CardDescription>
                امسح هذا الرمز للوصول السريع إلى حالة الحجز
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center">
                <div className="p-6 bg-white rounded-lg border-2 border-gray-200">
                  {statusUrl && <QRCodeSVG value={statusUrl} size={200} />}
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  احفظ هذا الرمز للوصول إلى حالتك في أي وقت
                </p>
              </div>

              {/* Status URL */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  value={statusUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 print:hidden">
            <Button
              onClick={() => router.push(statusUrl)}
              className="flex-1"
              size="lg"
            >
              عرض حالة الحجز
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="lg"
            >
              طباعة
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              size="lg"
            >
              <Home className="ml-2 h-4 w-4" />
              الرئيسية
            </Button>
          </div>

          {/* Important Notes */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-blue-900 mb-2">ملاحظات هامة:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>احتفظ برمز الـ QR أو الرابط للوصول إلى حالة الحجز</li>
                <li>سيتم تحديث الحالة تلقائياً عند اقتراب موعدك</li>
                <li>يرجى الحضور قبل موعدك بـ 10 دقائق</li>
                <li>في حالة التأخير، يرجى التواصل مع العيادة</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <p className="text-gray-600 text-center mb-4">حدث خطأ في تحميل بيانات الحجز</p>
          <Button onClick={() => router.push("/")} variant="outline">
            العودة للصفحة الرئيسية
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">جاري التحميل...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <BookingSuccessContent />
    </Suspense>
  );
}
