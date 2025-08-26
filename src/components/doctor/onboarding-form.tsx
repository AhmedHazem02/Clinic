
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useDoctorProfile } from "./doctor-profile-provider";
import { setDoctorProfile } from "@/services/queueService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";

const onboardingSchema = z.object({
  name: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل."),
  clinicPhoneNumber: z.string().regex(/^\d{11}$/, "الرجاء إدخال رقم هاتف صالح مكون من 11 رقمًا."),
  specialty: z.string().min(2, "التخصص مطلوب."),
  locations: z.array(z.object({ value: z.string().min(3, "لا يمكن أن يكون الموقع فارغًا.") })).min(1, "مطلوب موقع عيادة واحد على الأقل."),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export function OnboardingForm() {
  const router = useRouter();
  const { user } = useDoctorProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      clinicPhoneNumber: "",
      specialty: "",
      locations: [{ value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "locations",
  });

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب عليك تسجيل الدخول." });
      return;
    }
    setIsSubmitting(true);
    try {
      const profileData = {
        name: values.name,
        clinicPhoneNumber: values.clinicPhoneNumber,
        specialty: values.specialty,
        locations: values.locations.map(l => l.value),
      };
      await setDoctorProfile(user.uid, profileData);
      toast({ title: "تم حفظ الملف الشخصي", description: "تم إعداد ملفك الشخصي بنجاح." });
      router.push("/doctor/dashboard");
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ الملف الشخصي. يرجى المحاولة مرة أخرى." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">معلوماتك</CardTitle>
        <CardDescription>سيتم عرض هذه المعلومات لموظفيك ومرضاك.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl>
                    <Input placeholder="د. جين دو" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التخصص الطبي</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: طبيب قلب" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clinicPhoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم هاتف العيادة</FormLabel>
                  <FormControl>
                    <Input placeholder="01234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Label>موقع (مواقع) العيادة</Label>
              <div className="space-y-2 mt-2">
                {fields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`locations.${index}.value`}
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input placeholder={`الموقع ${index + 1}`} {...field} />
                                    </FormControl>
                                    {fields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => remove(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
              </div>
               <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ value: "" })}
              >
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة موقع
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "جاري الحفظ..." : "حفظ ومتابعة"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
