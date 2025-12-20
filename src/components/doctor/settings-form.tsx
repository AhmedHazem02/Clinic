
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { updateClinicSettings, listenToClinicSettings, type ClinicSettings, setDoctorProfile } from "@/services/queueService";
import { Skeleton } from "../ui/skeleton";
import { useDoctorProfile } from "./doctor-profile-provider";

const settingsSchema = z.object({
  consultationTime: z.coerce.number().min(5, "يجب أن يكون 5 دقائق على الأقل.").max(60, "لا يمكن أن يتجاوز 60 دقيقة."),
  consultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية."),
  reConsultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية."),
});

const specialtySchema = z.object({
  specialty: z.string().min(2, "يجب أن يكون التخصص حرفين على الأقل."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type SpecialtyFormValues = z.infer<typeof specialtySchema>;

const defaultFormValues: SettingsFormValues = {
  consultationTime: 15,
  consultationCost: 50,
  reConsultationCost: 25,
};

export function SettingsForm() {
  const { toast } = useToast();
  const { user, profile } = useDoctorProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSpecialty, setIsSubmittingSpecialty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultFormValues,
  });

  const specialtyForm = useForm<SpecialtyFormValues>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      specialty: profile?.specialty || "",
    },
  });

  useEffect(() => {
    const unsubscribe = listenToClinicSettings((settings) => {
      if (settings) {
        form.reset({
          consultationTime: settings.consultationTime || 15,
          consultationCost: settings.consultationCost || 50,
          reConsultationCost: settings.reConsultationCost || 25,
        });
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [form]);

  useEffect(() => {
    if (profile?.specialty) {
      specialtyForm.reset({ specialty: profile.specialty });
    }
  }, [profile, specialtyForm]);

  async function onSubmit(values: SettingsFormValues) {
    setIsSubmitting(true);
    try {
      await updateClinicSettings(values);
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تحديث إعدادات الاستشارة الخاصة بك.",
      });
    } catch (error) {
       toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يمكن حفظ الإعدادات. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSpecialtySubmit(values: SpecialtyFormValues) {
    if (!user) return;
    setIsSubmittingSpecialty(true);
    try {
      await setDoctorProfile(user.uid, { specialty: values.specialty });
      toast({
        title: "تم تحديث التخصص",
        description: "تم تحديث تخصصك بنجاح.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لا يمكن تحديث التخصص. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsSubmittingSpecialty(false);
    }
  }

  return (
    <div className="space-y-6">
   
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>التخصص الطبي</CardTitle>
        <CardDescription>
          قم بتحديث تخصصك الطبي.
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </CardContent>
      ) : (
      <Form {...specialtyForm}>
        <form onSubmit={specialtyForm.handleSubmit(onSpecialtySubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={specialtyForm.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التخصص</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: طب الأطفال، جراحة عامة..." {...field} />
                  </FormControl>
                  <FormDescription>
                    التخصص الطبي الخاص بك.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmittingSpecialty || isLoading}>
                {isSubmittingSpecialty ? "جاري الحفظ..." : "حفظ التخصص"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      )}
    </Card>
    </div>
  );
}
