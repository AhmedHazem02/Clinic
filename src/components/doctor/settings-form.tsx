
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
import { updateClinicSettings, listenToClinicSettings, type ClinicSettings } from "@/services/queueService";
import { Skeleton } from "../ui/skeleton";

const settingsSchema = z.object({
  consultationTime: z.coerce.number().min(5, "يجب أن يكون 5 دقائق على الأقل.").max(60, "لا يمكن أن يتجاوز 60 دقيقة."),
  consultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية."),
  reConsultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const defaultFormValues: SettingsFormValues = {
  consultationTime: 15,
  consultationCost: 50,
  reConsultationCost: 25,
};

export function SettingsForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultFormValues,
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

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="font-headline">إعدادات الاستشارة</CardTitle>
        <CardDescription>
          قم بتعيين متوسط الوقت والتكلفة لكل استشارة.
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </CardContent>
      ) : (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="consultationTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>متوسط وقت الاستشارة</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="15" {...field} />
                  </FormControl>
                  <FormDescription>
                    متوسط الوقت بالدقائق لاستشارة مريض واحد.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="consultationCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تكلفة الاستشارة</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50.00" {...field} />
                  </FormControl>
                   <FormDescription>
                    تكلفة استشارة مريض واحد.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reConsultationCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تكلفة إعادة الاستشارة</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="25.00" {...field} />
                  </FormControl>
                   <FormDescription>
                    تكلفة المتابعة أو إعادة الاستشارة.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      )}
    </Card>
  );
}
