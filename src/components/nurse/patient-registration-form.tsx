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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { addPatientToQueue, getPatientByPhone, type PatientInQueue } from "@/services/queueService";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{11}$/, "Please enter a valid 11-digit phone number."),
  age: z.coerce.number().optional(),
  diseases: z.string().optional(),
});

interface PatientRegistrationFormProps {
    onPatientRegistered: (patient: PatientInQueue) => void;
}

export function PatientRegistrationForm({ onPatientRegistered }: PatientRegistrationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      age: undefined,
      diseases: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await addPatientToQueue({
        name: values.name,
        phone: values.phone,
        age: values.age || null,
        chronicDiseases: values.diseases || null,
      });

      const newPatient = await getPatientByPhone(values.phone);
      if (newPatient) {
        onPatientRegistered(newPatient);
      }

      toast({
        title: "Patient Registered",
        description: `${values.name} has been added to the queue.`,
      });
      form.reset();
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Registration Failed",
        description: "Could not add patient to the queue. Please try again.",
      });
      console.error("Failed to register patient:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2"><UserPlus className="text-primary"/> New Patient</CardTitle>
        <CardDescription>
          Fill in the details to add a patient to the queue.
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
                  <FormLabel>Patient Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="01234567890" {...field} />
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
                  <FormLabel>Patient Age (optional)</FormLabel>
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
                  <FormLabel>Chronic Diseases (if any)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Hypertension, Diabetes"
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
                {isSubmitting ? "Adding..." : "Add to Queue"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
