"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Calendar, User, Phone, Stethoscope, AlertCircle } from "lucide-react";
import { getClinicBySlug, listActiveDoctorsForClinic, validatePhoneNumber } from "@/services/clinicPublicService";
import { Clinic, Doctor } from "@/types/multitenant";
import { toast } from "@/hooks/use-toast";

// Form validation schema
const bookingFormSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  phone: z.string().refine(validatePhoneNumber, {
    message: "رقم الهاتف غير صحيح (يجب أن يبدأ بـ 01 ويكون 11 رقم)",
  }),
  age: z.string().optional(),
  consultationReason: z.string().optional(),
  chronicDiseases: z.string().optional(),
  queueType: z.enum(["Consultation", "Re-consultation"]),
  doctorId: z.string().min(1, "يجب اختيار الطبيب"),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const clinicSlug = params.clinicSlug as string;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      queueType: "Consultation",
    },
  });

  const selectedDoctorId = watch("doctorId");

  // Load clinic and doctors
  useEffect(() => {
    async function loadClinicData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch clinic by slug
        const clinicData = await getClinicBySlug(clinicSlug);
        if (!clinicData) {
          setError("لم يتم العثور على العيادة");
          return;
        }

        setClinic(clinicData);

        // Fetch active doctors
        const doctorsData = await listActiveDoctorsForClinic(clinicData.id!);
        if (doctorsData.length === 0) {
          setError("لا يوجد أطباء متاحين في هذه العيادة حالياً");
          return;
        }

        setDoctors(doctorsData);

        // Auto-select if only one doctor
        if (doctorsData.length === 1) {
          setValue("doctorId", doctorsData[0].id!);
        }
      } catch (err) {
        console.error("Error loading clinic data:", err);
        setError("حدث خطأ في تحميل بيانات العيادة");
      } finally {
        setLoading(false);
      }
    }

    loadClinicData();
  }, [clinicSlug, setValue]);

  // Handle form submission (Step 5: Call server API instead of direct Firestore write)
  const onSubmit = async (data: BookingFormValues) => {
    if (!clinic) return;

    try {
      setSubmitting(true);

      // Call server-side booking API (secure, no direct Firestore writes)
      const response = await fetch('/api/public/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicSlug: clinicSlug,
          doctorId: data.doctorId,
          name: data.name,
          phone: data.phone,
          age: data.age ? parseInt(data.age, 10) : undefined,
          consultationReason: data.consultationReason,
          chronicDiseases: data.chronicDiseases,
          queueType: data.queueType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (result.error === 'Clinic not found' || result.error === 'Doctor not found') {
          toast({
            title: "خطأ",
            description: "بيانات العيادة أو الطبيب غير صحيحة",
            variant: "destructive",
          });
          return;
        }

        if (result.error === 'Patient already has an active booking today') {
          toast({
            title: "لديك حجز بالفعل",
            description: "لديك حجز نشط اليوم مع هذا الطبيب",
            variant: "default",
          });
          // Redirect to existing booking status
          if (result.existingTicketId) {
            router.push(`/status/${clinic.id}/${data.doctorId}/${result.existingTicketId}`);
          }
          return;
        }

        throw new Error(result.error || 'Booking failed');
      }

      // Success - redirect to success page with ticket ID
      router.push(`/book/${clinicSlug}/success?ticketId=${result.ticketId}`);
    } catch (err) {
      console.error("Error creating booking:", err);
      toast({
        title: "فشل الحجز",
        description: "حدث خطأ أثناء إنشاء الحجز. حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">جاري تحميل بيانات العيادة...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">خطأ</h2>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <Button onClick={() => router.push("/")} variant="outline">
              العودة للصفحة الرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Clinic Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-900">
              {clinic?.name}
            </CardTitle>
            <CardDescription>
              احجز موعدك الآن
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              نموذج الحجز
            </CardTitle>
            <CardDescription>
              املأ البيانات التالية لإتمام الحجز
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Doctor Selection */}
              <div className="space-y-2">
                <Label htmlFor="doctorId" className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  اختر الطبيب *
                </Label>
                <Select
                  value={selectedDoctorId}
                  onValueChange={(value) => setValue("doctorId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطبيب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id!}>
                        {doctor.name} - {doctor.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.doctorId && (
                  <p className="text-sm text-red-500">{errors.doctorId.message}</p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  الاسم *
                </Label>
                <Input
                  id="name"
                  placeholder="الاسم الكامل"
                  {...register("name")}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  رقم الهاتف *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  {...register("phone")}
                  className={errors.phone ? "border-red-500" : ""}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone.message}</p>
                )}
              </div>

              {/* Age */}
              <div className="space-y-2">
                <Label htmlFor="age">العمر</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="مثال: 30"
                  {...register("age")}
                />
              </div>

              {/* Queue Type */}
              <div className="space-y-2">
                <Label>نوع الكشف</Label>
                <RadioGroup
                  defaultValue="Consultation"
                  onValueChange={(value) => setValue("queueType", value as "Consultation" | "Re-consultation")}
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="Consultation" id="consultation" />
                    <Label htmlFor="consultation" className="cursor-pointer">
                      كشف ({clinic?.settings?.consultationCost || 200} جنيه)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="Re-consultation" id="reconsultation" />
                    <Label htmlFor="reconsultation" className="cursor-pointer">
                      إعادة كشف ({clinic?.settings?.reConsultationCost || 100} جنيه)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Consultation Reason */}
              <div className="space-y-2">
                <Label htmlFor="consultationReason">سبب الزيارة</Label>
                <Textarea
                  id="consultationReason"
                  placeholder="اختياري - اكتب سبب الزيارة"
                  rows={3}
                  {...register("consultationReason")}
                />
              </div>

              {/* Chronic Diseases */}
              <div className="space-y-2">
                <Label htmlFor="chronicDiseases">الأمراض المزمنة</Label>
                <Textarea
                  id="chronicDiseases"
                  placeholder="اختياري - مثل: سكري، ضغط"
                  rows={2}
                  {...register("chronicDiseases")}
                />
              </div>

              {/* Info Alert */}
              {selectedDoctor && (
                <Alert>
                  <AlertDescription className="text-sm">
                    سيتم حجزك مع <strong>{selectedDoctor.name}</strong> (
                    {selectedDoctor.specialty})
                    <br />
                    مدة الكشف المتوقعة: {clinic?.settings?.consultationTime || 15} دقيقة
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحجز...
                  </>
                ) : (
                  "تأكيد الحجز"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Privacy Note */}
        <p className="text-center text-sm text-gray-500 mt-4">
          بيانات الحجز محمية وآمنة ولن يتم مشاركتها مع أي جهة خارجية
        </p>
      </div>
    </div>
  );
}
