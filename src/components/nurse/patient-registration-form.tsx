
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

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{11}$/, "Please enter a valid 11-digit phone number."),
  bookingDate: z.date({
    required_error: "A reservation date is required.",
  }),
  age: z.coerce.number().optional(),
  diseases: z.string().optional(),
  queueType: z.enum(["Consultation", "Re-consultation"]),
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
    setIsSubmitting(true);
    try {
      await addPatientToQueue({
        name: values.name,
        phone: values.phone,
        bookingDate: values.bookingDate,
        age: values.age || null,
        chronicDiseases: values.diseases || null,
        queueType: values.queueType as QueueType,
      });

      const newPatient = await getPatientByPhone(values.phone);
      if (newPatient) {
        onPatientRegistered(newPatient);
      }

      toast({
        title: "Patient Registered",
        description: `${values.name} has been added to the queue.`,
      });
      form.reset({
        name: "",
        phone: "",
        age: undefined,
        diseases: "",
        bookingDate: new date(),
        queueType: "Consultation",
      });
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not add patient to the queue. Please try again.",
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
              name="bookingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Reservation Date</FormLabel>
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
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                  <FormLabel>Queue Type</FormLabel>
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
                          Consultation
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Re-consultation" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Re-consultation
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
