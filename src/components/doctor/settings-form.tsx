
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
  consultationTime: z.coerce.number().min(5, "Must be at least 5 minutes.").max(60, "Cannot exceed 60 minutes."),
  consultationCost: z.coerce.number().min(0, "Cost cannot be negative."),
  reConsultationCost: z.coerce.number().min(0, "Cost cannot be negative."),
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
        title: "Settings Saved",
        description: "Your consultation settings have been updated.",
      });
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save settings. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="font-headline">Consultation Settings</CardTitle>
        <CardDescription>
          Set the average time and cost for each consultation.
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
                  <FormLabel>Average Consultation Time</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="15" {...field} />
                  </FormControl>
                  <FormDescription>
                    The average time in minutes for a single patient consultation.
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
                  <FormLabel>Consultation Cost</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50.00" {...field} />
                  </FormControl>
                   <FormDescription>
                    The cost for a single patient consultation.
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
                  <FormLabel>Re-consultation Cost</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="25.00" {...field} />
                  </FormControl>
                   <FormDescription>
                    The cost for a follow-up or re-consultation.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      )}
    </Card>
  );
}
