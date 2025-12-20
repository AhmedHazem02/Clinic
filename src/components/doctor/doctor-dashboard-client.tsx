
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Download, Printer, User, HeartPulse, LogIn, CheckCircle, MessageSquarePlus, DollarSign, Info, Settings, FileText, CalendarClock, Users, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listenToQueue, type PatientInQueue, finishAndCallNext, updatePatientStatus, updateDoctorMessage, listenToDoctorMessage, listenToClinicSettings, updateDoctorRevenue, listenToDoctorProfile, getPreviousBookings } from "@/services/queueService";
import { Skeleton } from "@/components/ui/skeleton";
import { useDoctorProfile } from "./doctor-profile-provider";
import { generatePatientReport, setDoctorAvailability } from "@/app/actions";
import { PrintablePrescription } from "./printable-prescription";
import { addDays, isToday } from "date-fns";
import {
  AiAssistedPrescriptionInput,
  generatePrescriptionPhrases,
} from "@/ai/flows/ai-assisted-prescription";
import { Wand2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";

export function DoctorDashboardClient() {
  const { user, profile, userProfile } = useDoctorProfile();
  const [isAvailable, setIsAvailable] = useState(true);
  const [prescription, setPrescription] = useState("");
  const { toast } = useToast();

  const [queue, setQueue] = useState<PatientInQueue[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<PatientInQueue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [todaysRevenue, setTodaysRevenue] = useState(0);
  const [consultationCost, setConsultationCost] = useState(0);
  const [reConsultationCost, setReConsultationCost] = useState(0);
  const [previousBookings, setPreviousBookings] = useState<PatientInQueue[]>([]);
  const [isFetchingBookings, setIsFetchingBookings] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [desiredEffect, setDesiredEffect] = useState("");

  useEffect(() => {
    if (!user || !userProfile) return;

    const clinicId = 'clinicId' in userProfile ? userProfile.clinicId : undefined;

    const unsubscribeSettings = listenToClinicSettings((settings) => {
      if (settings) {
        console.log('⚙️ Clinic settings loaded:', settings);
        setConsultationCost(settings.consultationCost);
        setReConsultationCost(settings.reConsultationCost);
      } else {
        console.warn('⚠️ No clinic settings found');
      }
    }, clinicId);

    const unsubscribeQueue = listenToQueue(
      user.uid, 
      (updatedQueue) => {
        setQueue(updatedQueue);
        
        const upcoming = updatedQueue
          .filter(p => p.status === 'Waiting' && isToday(p.bookingDate))
          .sort((a, b) => a.queueNumber - b.queueNumber);
        setUpcomingReservations(upcoming);
        
        setIsLoading(false);
      },
      async (error) => {
        // Handle permission errors - user might be deactivated
        if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
          const { signOutUser } = await import('@/services/authClientService');
          await signOutUser();
          window.location.href = '/login?message=تم إيقاف حسابك من قبل الإدارة';
        }
      },
      'clinicId' in userProfile ? userProfile.clinicId : undefined
    );
    
    const unsubscribeMessage = listenToDoctorMessage(user.uid, (message) => {
      setDoctorMessage(message);
    });

    const unsubscribeProfile = listenToDoctorProfile(user.uid, (profile) => {
        if(profile) {
            setIsAvailable(profile.isAvailable ?? true);
        }
    });

    return () => {
      unsubscribeQueue();
      unsubscribeMessage();
      unsubscribeSettings();
      unsubscribeProfile();
    };
  }, [user, userProfile]);

  // حساب إيرادات اليوم - يتم تشغيلها كلما تغيرت القائمة أو الأسعار
  useEffect(() => {
    const finishedToday = queue.filter(p => 
      p.status === 'Finished' && isToday(p.bookingDate)
    );
    
    const revenue = finishedToday.reduce((total, patient) => {
      const cost = patient.queueType === 'Re-consultation' 
        ? reConsultationCost 
        : consultationCost;
      return total + cost;
    }, 0);
    
    console.log('📊 Revenue calculation:', {
      finishedToday: finishedToday.length,
      consultationCost,
      reConsultationCost,
      revenue,
      patients: finishedToday.map(p => ({
        name: p.name,
        type: p.queueType,
        cost: p.queueType === 'Re-consultation' ? reConsultationCost : consultationCost
      }))
    });
    
    setTodaysRevenue(revenue);
  }, [queue, consultationCost, reConsultationCost]);

  const currentPatient = queue.find(p => p.status === 'Consulting');
  const nextPatient = queue.find(p => p.status === 'Waiting');

  useEffect(() => {
      if (currentPatient) {
          setPrescription(currentPatient.prescription || "");
      }
  }, [currentPatient]);

  const handleAvailabilityChange = async (checked: boolean) => {
      if (!user) return;
      
      const previousState = isAvailable;
      setIsAvailable(checked); // Optimistically update UI

      const result = await setDoctorAvailability(user.uid, checked);
      
      if (!result.success) {
        toast({ variant: "destructive", title: "خطأ", description: "لا يمكن تحديث حالة التوافر." });
        setIsAvailable(previousState); // Revert UI on failure
      } else {
        toast({ title: "تم تحديث الحالة", description: `أنت الآن ${checked ? 'متاح' : 'غير متاح'}.` });
        if (checked) {
            setDoctorMessage("");
            await updateDoctorMessage("", user.uid);
        }
      }
  }

  const handleCallNext = async () => {
    if (!nextPatient) {
        toast({ variant: "destructive", title: "لا يوجد مرضى في الانتظار." });
        return;
    }
    try {
        if (currentPatient) {
            await finishAndCallNext(currentPatient.id, nextPatient.id, prescription);
            const cost = currentPatient.queueType === 'Re-consultation' ? reConsultationCost : consultationCost;
            if(user) {
                await updateDoctorRevenue(user.uid, cost);
            }
        } else {
            await updatePatientStatus(nextPatient.id, 'Consulting');
        }
        setPrescription(""); 
        toast({ title: "نجاح", description: `جاري الاتصال بـ ${nextPatient.name} للاستشارة.` });
    } catch (error) {
        console.error("Error calling next patient:", error);
        toast({ variant: "destructive", title: "خطأ", description: "لا يمكن الاتصال بالمريض التالي." });
    }
  }

  const handleFinishConsultation = async () => {
      if (!currentPatient) return;
      try {
        await updatePatientStatus(currentPatient.id, 'Finished', prescription);
        const cost = currentPatient.queueType === 'Re-consultation' ? reConsultationCost : consultationCost;
        if (user) {
            await updateDoctorRevenue(user.uid, cost);
        }
        setPrescription("");
        toast({ title: "انتهت الاستشارة", description: `اكتملت استشارة ${currentPatient.name}.` });
      } catch (error) {
        toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إنهاء الاستشارة." });
      }
  }

  const handlePrint = () => {
    if (!currentPatient || !prescription.trim()) {
        toast({
            variant: "destructive",
            title: "لا يمكن الطباعة",
            description: "يرجى التأكد من تحديد مريض وكتابة وصفة طبية.",
        });
        return;
    }
    window.print();
  }
  
  const handleUpdateMessage = async () => {
    if (!user) return;
    setIsUpdatingMessage(true);
    try {
      await updateDoctorMessage(doctorMessage, user.uid);
      toast({
        title: "تم تحديث الرسالة",
        description: "تم تحديث رسالتك لجميع المرضى.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يمكن تحديث الرسالة.",
      });
    } finally {
      setIsUpdatingMessage(false);
    }
  };

  const handleFetchPreviousBookings = async () => {
    if (!user || !dateRange || !dateRange.from || !dateRange.to) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى تحديد نطاق زمني.",
      });
      return;
    }
    setIsFetchingBookings(true);
    try {
      const allBookings = await getPreviousBookings(
        user.uid,
        dateRange.from,
        dateRange.to
      );
      // Filter and sort for finished bookings on the client side
      const finishedBookings = allBookings
        .filter((b) => b.status === "Finished")
        .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
      
      setPreviousBookings(finishedBookings);

      if (finishedBookings.length === 0) {
        toast({
          title: "لا توجد حجوزات",
          description:
            "لم يتم العثور على حجوزات مكتملة في هذا النطاق الزمني.",
        });
      }
    } catch (error) {
      console.error("Error fetching previous bookings:", error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل في جلب الحجوزات السابقة.",
      });
    } finally {
      setIsFetchingBookings(false);
    }
  };

  const handleGeneratePrescription = async () => {
    if (!currentPatient || !desiredEffect) return;

    setIsGenerating(true);
    try {
      const input: AiAssistedPrescriptionInput = {
        patientName: currentPatient.name,
        patientDetails: `Age: ${currentPatient.age}, Chronic Diseases: ${currentPatient.chronicDiseases}, Consultation Reason: ${currentPatient.consultationReason}`,
        desiredEffect: desiredEffect,
      };
      const result = await generatePrescriptionPhrases(input);
      setPrescription(result.prescriptionPhrases.join("\n"));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "فشل إنشاء الروشتة",
        description:
          "حدث خطأ أثناء إنشاء الروشتة. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isNewAccount = !isLoading && queue.length === 0;

  return (
    <>
      {isNewAccount && (
        <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>مرحبًا بك في QueueWise!</AlertTitle>
            <AlertDescription>
                <p>يبدو أن هذه هي المرة الأولى لك هنا. للبدء، يرجى تعيين متوسط وقت الاستشارة والتكلفة.</p>
                
            </AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end mb-4">
        <Button asChild variant="outline">
          <Link href="/admin/dashboard">
            <LayoutDashboard className="ml-2 h-4 w-4" />
            لوحة تحكم الإدارة
          </Link>
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <User className="text-primary"/> المريض الحالي
                </CardTitle>
                <CardDescription>
                    {currentPatient ? "المريض ينتظر الاستشارة." : "لا يوجد مريض حاليًا في الاستشارة."}
                </CardDescription>
            </CardHeader>
            {isLoading ? (
                <CardContent className="space-y-2">
                    <Skeleton className="h-7 w-1/2" />
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                </CardContent>
            ) : currentPatient ? (
                <CardContent className="space-y-2">
                    <h3 className="text-xl font-bold">{currentPatient.name}</h3>
                    <p className="text-sm"><strong className="font-medium">العمر:</strong> {currentPatient.age || 'غير متوفر'}</p>
                     <p className="text-sm flex items-start">
                        <FileText className="h-4 w-4 ml-2 mt-0.5 text-primary flex-shrink-0"/> 
                        <strong className="font-medium">السبب:</strong> {currentPatient.consultationReason || 'غير متوفر'}
                    </p>
                    <p className="text-sm flex items-start">
                        <HeartPulse className="h-4 w-4 ml-2 mt-0.5 text-destructive flex-shrink-0"/> 
                        <strong className="font-medium">الأمراض المزمنة:</strong> {currentPatient.chronicDiseases || 'لا يوجد'}
                    </p>
                </CardContent>
            ) : (
                <CardContent>
                    <p className="text-muted-foreground">في انتظار استدعاء المريض التالي.</p>
                </CardContent>
            )}
            <CardFooter>
                {currentPatient ? (
                    <div className="flex gap-2">
                        <Button onClick={handleFinishConsultation} variant="outline">
                            <CheckCircle /> إنهاء الاستشارة
                        </Button>
                        <Button onClick={handleCallNext} disabled={!nextPatient}>
                            <LogIn /> إنهاء واستدعاء التالي
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleCallNext} disabled={!nextPatient || !isAvailable}>
                        <LogIn /> استدعاء المريض التالي
                    </Button>
                )}
            </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="text-primary"/> الحجوزات القادمة
                    </CardTitle>
                    <CardDescription>المرضى المنتظرون في قائمة الانتظار لهذا اليوم.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-64">
                        {isLoading ? (
                             <div className="space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : upcomingReservations.length > 0 ? (
                            <div className="space-y-2">
                                {upcomingReservations.map(patient => (
                                     <div key={patient.id} className="flex justify-between items-center p-2 border rounded-md">
                                        <div>
                                            <p className="font-semibold">{patient.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                #{patient.queueNumber}
                                            </p>
                                        </div>
                                        <Badge variant={patient.queueType === 'Re-consultation' ? 'secondary' : 'outline'}>
                                            {patient.queueType === 'Re-consultation' ? 'إعادة استشارة' : 'استشارة'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <p className="text-muted-foreground text-center py-4">لا توجد حجوزات قادمة اليوم.</p>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>كتابة الروشتة</CardTitle>
                <CardDescription>
                  {currentPatient ? `اكتب روشتة لـ ${currentPatient.name}.` : "لا يوجد مريض نشط."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="مثال: تناول قرصًا واحدًا من الباراسيتامول 500 ملغ..."
                  className="min-h-[150px]"
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  disabled={!currentPatient}
                />
                <div className="space-y-2">
                  <Label htmlFor="desired-effect">
                    التأثير المطلوب (للمساعدة بالذكاء الاصطناعي)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="desired-effect"
                      placeholder="مثال: خافض للحرارة ومسكن للألم"
                      value={desiredEffect}
                      onChange={(e) => setDesiredEffect(e.target.value)}
                      disabled={!currentPatient || isGenerating}
                    />
                    <Button
                      onClick={handleGeneratePrescription}
                      disabled={!currentPatient || isGenerating || !desiredEffect}
                    >
                      <Wand2 />
                      {isGenerating ? "جاري الإنشاء..." : "إنشاء"}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-2 justify-end">
                <Button variant="secondary" onClick={handlePrint} disabled={!currentPatient || !prescription.trim()}>
                  <Printer className="ml-2" /> طباعة
                </Button>
              </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="text-primary"/> الحجوزات السابقة
                    </CardTitle>
                    <CardDescription>عرض الحجوزات المكتملة في نطاق زمني محدد.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                       <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        <Button onClick={handleFetchPreviousBookings} disabled={isFetchingBookings}>
                            {isFetchingBookings ? 'جاري البحث...' : 'بحث'}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {isFetchingBookings ? (
                            <>
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </>
                        ) : previousBookings.length > 0 ? (
                            previousBookings.map(booking => (
                                <div key={booking.id} className="flex justify-between items-center p-2 border rounded-md">
                                    <div>
                                        <p className="font-semibold">{booking.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(booking.bookingDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium">{booking.queueType}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-4">حدد نطاقًا زمنيًا واضغط على بحث لعرض الحجوزات.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
            <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                <CardTitle>حالتي</CardTitle>
                <CardDescription>قم بتعيين حالتك.</CardDescription>
                </div>
                <Switch
                checked={isAvailable}
                onCheckedChange={handleAvailabilityChange}
                aria-label="Doctor availability status"
                />
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className={`text-lg font-semibold ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {isAvailable ? "متاح للاستشارة" : "غير متاح"}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="doctor-message">رسالة للمريض</Label>
                    <Textarea 
                        id="doctor-message"
                        placeholder="مثال: سأتأخر 15 دقيقة."
                        value={doctorMessage}
                        onChange={(e) => setDoctorMessage(e.target.value)}
                        disabled={!isAvailable} 
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleUpdateMessage} disabled={isUpdatingMessage || !isAvailable}>
                <MessageSquarePlus /> {isUpdatingMessage ? 'جاري التحديث...' : 'تحديث الرسالة'}
                </Button>
            </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="text-primary"/> إيرادات اليوم
                    </CardTitle>
                    <CardDescription>إجمالي الأرباح من الاستشارات المكتملة اليوم.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Skeleton className="h-10 w-24" />
                    ) : (
                        <p className="text-3xl font-bold">
                            {todaysRevenue.toFixed(2)} جنية مصري
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
       {currentPatient && profile && (
        <PrintablePrescription
          patient={currentPatient}
          doctor={profile}
          prescription={prescription}
        />
      )}
    </>
  );
}

