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
import { useState } from "react";

const settingsSchema = z.object({
  consultationTime: z.coerce.number().min(5, "Must be at least 5 minutes.").max(60, "Cannot exceed 60 minutes."),
  consultationCost: z.coerce.number().min(0, "Cost cannot be negative."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function SettingsForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In a real app, you would fetch these default values from a database.
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      consultationTime: 15,
      consultationCost: 50,
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    setIsSubmitting(true);
    console.log("Saving settings:", values);

    // Mock saving the data
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Settings Saved",
      description: "Your consultation settings have been updated.",
    });
    setIsSubmitting(false);
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="font-headline">Consultation Settings</CardTitle>
        <CardDescription>
          Set the average time and cost for each consultation.
        </CardDescription>
      </CardHeader>
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
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
