
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Upload, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { sendPasswordReset } from "@/services/authClientService";
import { useNurseProfile } from "./nurse-profile-provider";
import { setNurseProfile } from "@/services/queueService";
import { Skeleton } from "../ui/skeleton";

const profileSchema = z.object({
  name: z.string().min(2, "يجب أن يتكون الاسم من حرفين على الأقل."),
  email: z.string().email("الرجاء إدخال بريد إلكتروني صالح."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function NurseProfileForm() {
  const { user, profile, isLoading } = useNurseProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        email: profile.email,
      });
      setAvatarPreview(profile.avatarUrl || null);
    } else if (user) {
      form.reset({
        name: user.displayName || "",
        email: user.email || "",
      });
    }
  }, [profile, user, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يجب عليك تسجيل الدخول.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const profileData = {
        name: values.name,
        email: values.email,
        // In a real app, you would handle avatar upload and get a URL
      };
      await setNurseProfile(user.uid, profileData);
      toast({
        title: "تم حفظ الملف الشخصي",
        description: "تم تحديث ملفك الشخصي بنجاح.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل حفظ الملف الشخصي. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  };
  
  if (isLoading) {
      return (
          <Card className="max-w-2xl">
              <CardHeader>
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                      <Skeleton className="h-20 w-20 rounded-full" />
                      <Skeleton className="h-10 w-32" />
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
      );
  }

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>معلوماتك</CardTitle>
            <CardDescription>
              سيتم عرض هذه المعلومات في لوحة الممرض.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={avatarPreview || "https://placehold.co/80x80.png"}
                  alt={form.getValues("name")}
                  data-ai-hint="nurse avatar"
                />
                <AvatarFallback>
                  {getInitials(form.getValues("name"))}
                </AvatarFallback>
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
                    <Input placeholder="الممرض سميث" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input placeholder="nurse@example.com" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
