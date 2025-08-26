"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useDoctorProfile } from "./doctor-profile-provider";
import { setDoctorProfile } from "@/services/queueService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  clinicPhoneNumber: z.string().regex(/^\d{11}$/, "Please enter a valid 11-digit phone number."),
  specialty: z.string().min(2, "Specialty is required."),
  locations: z.array(z.object({ value: z.string().min(3, "Location cannot be empty.") })).min(1, "At least one clinic location is required."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const { user, profile, isLoading } = useDoctorProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      clinicPhoneNumber: "",
      specialty: "",
      locations: [{ value: "" }],
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        clinicPhoneNumber: profile.clinicPhoneNumber,
        specialty: profile.specialty,
        locations: (profile.locations || []).map(l => ({ value: l })),
      });
    }
  }, [profile, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "locations",
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    try {
      const profileData = {
        name: values.name,
        clinicPhoneNumber: values.clinicPhoneNumber,
        specialty: values.specialty,
        locations: values.locations.map(l => l.value),
        // In a real app, you would handle the avatar upload here
      };
      await setDoctorProfile(user.uid, profileData);
      toast({ title: "Profile Saved", description: "Your profile has been successfully updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save profile. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                 <Skeleton className="h-8 w-48" />
                 <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-10 w-32" />
            </CardFooter>
        </Card>
    )
  }

  const getInitials = (name: string) => {
    if (!name) return "";
    return name.split(' ').map(n => n[0]).join('');
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
                <CardTitle className="font-headline">Your Information</CardTitle>
                <CardDescription>This information will be displayed to your staff and patients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={avatarPreview || "https://placehold.co/80x80.png"} alt={profile?.name} data-ai-hint="doctor avatar" />
                        {profile?.name && <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>}
                    </Avatar>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg"
                    />
                    <Button type="button" variant="outline" disabled>
                        <Upload /> Upload Photo
                    </Button>
                </div>
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Dr. Jane Doe" {...field} />
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
                    <FormLabel>Medical Specialty</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Cardiologist" {...field} />
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
                    <FormLabel>Clinic Phone Number</FormLabel>
                    <FormControl>
                        <Input placeholder="01234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div>
                <Label>Clinic Location(s)</Label>
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
                                            <Input placeholder={`Location ${index + 1}`} {...field} />
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
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Location
                </Button>
                </div>
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
            </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
