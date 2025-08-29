
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { addPatientToQueue, getPatientByPhone, type PatientInQueue, type QueueType } from "@/services/queueService";
import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useNurseProfile } from "./nurse-profile-provider";

const formSchema = z.object({
  name: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل."),
  phone: z.string().regex(/^\d{11}$/, "الرجاء إدخال رقم هاتف صالح مكون من 11 رقمًا."),
  bookingDate: z.date({
    required_error: "تاريخ الحجز مطلوب.",
  }),
  age: z.coerce.number().optional(),
  diseases: z.string().optional(),
  consultationReason: z.string().optional(),
  queueType: z.enum(["Consultation", "Re-consultation"]),
});

interface PatientRegistrationFormProps {
    onPatientRegistered: (patient: PatientInQueue) => void;
}

export function PatientRegistrationForm({ onPatientRegistered }: PatientRegistrationFormProps) {
  const { user, profile } = useNurseProfile();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      age: undefined,
      diseases: "",
      consultationReason: "",
      queueType: "Consultation",
    },
  });

  useEffect(() => {
    form.reset({
        ...form.getValues(),
        bookingDate: new Date(),
    });
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !profile) {
        toast({
            variant: "destructive",
            title: "خطأ",
            description: "يجب عليك تسجيل الدخول لتسجيل المرضى.",
        });
        return;
    }

    setIsSubmitting(true);
    try {
      await addPatientToQueue({
        name: values.name,
        // Since nurse and doctor are the same user, we use the nurse's UID as the doctorId
        doctorId: user.uid,
        phone: values.phone,
        bookingDate: values.bookingDate,
        age: values.age || null,
        chronicDiseases: values.diseases || null,
        consultationReason: values.consultationReason || null,
        queueType: values.queueType as QueueType,
        nurseId: user.uid,
        nurseName: profile.name,
      });

      const newPatient = await getPatientByPhone(values.phone, user.uid);
      if (newPatient) {
        onPatientRegistered(newPatient);
      }

      toast({
        title: "تم تسجيل المريض",
        description: `تمت إضافة ${values.name} إلى قائمة الانتظار.`,
      });
      form.reset({
        name: "",
        phone: "",
        age: undefined,
        diseases: "",
        consultationReason: "",
        bookingDate: new Date(),
        queueType: "Consultation",
      });
    } catch (error: any) {
       if (error.message.includes("is already in the queue")) {
        form.setError("phone", {
          type: "manual",
          message: "هذا المريض موجود بالفعل في قائمة الانتظار النشطة.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "فشل التسجيل",
          description: error.message || "لا يمكن إضافة المريض إلى قائمة الانتظار. يرجى المحاولة مرة أخرى.",
        });
      }
      console.error("Failed to register patient:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="text-primary"/> مريض جديد</CardTitle>
        <CardDescription>
          املأ التفاصيل لإضافة مريض إلى قائمة الانتظار.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المريض</FormLabel>
                  <FormControl>
                    <Input placeholder="جون دو" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الهاتف</FormLabel>
                  <FormControl>
                    <Input placeholder="01234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="bookingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>تاريخ الحجز</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>اختر تاريخًا</span>
                          )}
                          <CalendarIcon className="mr-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="queueType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>نوع قائمة الانتظار</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Consultation" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          استشارة
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Re-consultation" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          إعادة استشارة
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="consultationReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سبب الاستشارة</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="مثال: متابعة، فحص عام..."
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عمر المريض (اختياري)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="35" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diseases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الأمراض المزمنة (إن وجدت)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="مثال: ارتفاع ضغط الدم، السكري"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "جاري الإضافة..." : "إضافة إلى قائمة الانتظار"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
