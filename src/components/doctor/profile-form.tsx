
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const profileSchema = z.object({
  name: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل."),
  clinicPhoneNumbers: z.array(z.object({ value: z.string().regex(/^\d{11}$/, "الرجاء إدخال رقم هاتف صالح مكون من 11 رقمًا.") })).min(1, "مطلوب رقم هاتف عيادة واحد على الأقل."),
  specialty: z.string().min(2, "التخصص مطلوب."),
  locations: z.array(z.object({ value: z.string().min(3, "لا يمكن أن يكون الموقع فارغًا.") })).min(1, "مطلوب موقع عيادة واحد على الأقل."),
  isAvailable: z.boolean().optional(),
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
      clinicPhoneNumbers: [{ value: "" }],
      specialty: "",
      locations: [{ value: "" }],
      isAvailable: true,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        clinicPhoneNumbers: (profile.clinicPhoneNumbers || []).map(p => ({ value: p })),
        specialty: profile.specialty,
        locations: (profile.locations || []).map(l => ({ value: l })),
        isAvailable: profile.isAvailable ?? true,
      });
    }
  }, [profile, form]);

  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({
    control: form.control,
    name: "locations",
  });

  const { fields: phoneFields, append: appendPhone, remove: removePhone } = useFieldArray({
    control: form.control,
    name: "clinicPhoneNumbers",
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب عليك تسجيل الدخول." });
      return;
    }
    setIsSubmitting(true);
    try {
      const profileData = {
        name: values.name,
        clinicPhoneNumbers: values.clinicPhoneNumbers.map(p => p.value),
        specialty: values.specialty,
        locations: values.locations.map(l => l.value),
        isAvailable: values.isAvailable,
        // In a real app, you would handle the avatar upload here
      };
      await setDoctorProfile(user.uid, profileData);
      toast({ title: "تم حفظ الملف الشخصي", description: "تم تحديث ملفك الشخصي بنجاح." });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ الملف الشخصي. يرجى المحاولة مرة أخرى." });
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
                <CardTitle className="font-headline">معلوماتك</CardTitle>
                <CardDescription>سيتم عرض هذه المعلومات لموظفيك ومرضاك.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={avatarPreview || profile?.avatarUrl || "https://placehold.co/80x80.png"} alt={profile?.name} data-ai-hint="doctor avatar" />
                        {profile?.name && <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>}
                    </Avatar>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg"
                    />
                    <Button type="button" variant="outline" disabled>
                        <Upload /> تحميل صورة
                    </Button>
                </div>
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
                <div>
                  <Label>أرقام هواتف العيادة</Label>
                  <div className="space-y-2 mt-2">
                    {phoneFields.map((field, index) => (
                        <FormField
                            key={field.id}
                            control={form.control}
                            name={`clinicPhoneNumbers.${index}.value`}
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input placeholder={`رقم الهاتف ${index + 1}`} {...field} />
                                        </FormControl>
                                        {phoneFields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => removePhone(index)}
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
                    onClick={() => appendPhone({ value: "" })}
                  >
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة رقم هاتف
                  </Button>
                </div>
                <div>
                <Label>موقع (مواقع) العيادة</Label>
                <div className="space-y-2 mt-2">
                    {locationFields.map((field, index) => (
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
                                        {locationFields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => removeLocation(index)}
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
                    onClick={() => appendLocation({ value: "" })}
                >
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة موقع
                </Button>
                </div>
                <FormField
                  control={form.control}
                  name="isAvailable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">الحالة</FormLabel>
                        <FormDescription>
                          عند التفعيل، يمكن لمرضاك الانضمام إلى قائمة الانتظار الخاصة بك.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
            </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
