"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Building2, Phone, MapPin, Clock, DollarSign, Save } from "lucide-react";
import { getFirebase } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getUserProfileWithLegacyFallback } from "@/services/userProfileService";
import { onAuthChange } from "@/services/authClientService";
import type { Clinic } from "@/types/multitenant";

const clinicSettingsSchema = z.object({
  // Basic Info
  name: z.string().min(2, "اسم العيادة يجب أن يكون حرفين على الأقل"),
  slug: z.string().min(2, "الرابط يجب أن يكون حرفين على الأقل").regex(/^[a-z0-9-]+$/, "الرابط يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط"),
  
  // Contact Info
  phoneNumbers: z.string().optional(),
  locations: z.string().optional(),
  
  // Consultation Settings
  consultationTime: z.coerce.number().min(5, "يجب أن يكون 5 دقائق على الأقل").max(120, "لا يمكن أن يتجاوز 120 دقيقة"),
  consultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية"),
  reConsultationCost: z.coerce.number().min(0, "لا يمكن أن تكون التكلفة سلبية"),
});

type ClinicSettingsFormValues = z.infer<typeof clinicSettingsSchema>;

export function ClinicSettingsForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const form = useForm<ClinicSettingsFormValues>({
    resolver: zodResolver(clinicSettingsSchema),
    defaultValues: {
      name: "",
      slug: "",
      phoneNumbers: "",
      locations: "",
      consultationTime: 15,
      consultationCost: 50,
      reConsultationCost: 25,
    },
  });

  useEffect(() => {
    const loadClinicSettings = async () => {
      const unsubscribeAuth = onAuthChange(async (user) => {
        if (!user) {
          setIsLoading(false);
          return;
        }

        try {
          const userProfile = await getUserProfileWithLegacyFallback(user.uid);
          if (!userProfile || !('clinicId' in userProfile) || !userProfile.clinicId) {
            toast({
              variant: "destructive",
              title: "خطأ",
              description: "لم يتم العثور على معلومات العيادة",
            });
            setIsLoading(false);
            return;
          }

          const currentClinicId = userProfile.clinicId;
          setClinicId(currentClinicId);

          // Load clinic data
          const { db } = getFirebase();
          const clinicRef = doc(db, 'clinics', currentClinicId);
          const clinicSnap = await getDoc(clinicRef);

          if (clinicSnap.exists()) {
            const clinicData = clinicSnap.data() as Clinic;
            
            // Reset form with clinic data
            form.reset({
              name: clinicData.name || "",
              slug: clinicData.slug || "",
              phoneNumbers: clinicData.phoneNumbers?.join(', ') || "",
              locations: clinicData.locations?.join(', ') || "",
              consultationTime: clinicData.settings?.consultationTime || 15,
              consultationCost: clinicData.settings?.consultationCost || 50,
              reConsultationCost: clinicData.settings?.reConsultationCost || 25,
            });
            setIsLoading(false);
          } else {
            toast({
              variant: "destructive",
              title: "خطأ",
              description: "لم يتم العثور على بيانات العيادة",
            });
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error loading clinic settings:', error);
          toast({
            variant: "destructive",
            title: "خطأ",
            description: "فشل تحميل إعدادات العيادة",
          });
          setIsLoading(false);
        }
      });

      return () => unsubscribeAuth();
    };

    loadClinicSettings();
  }, [form, toast]);

  async function onSubmit(values: ClinicSettingsFormValues) {
    if (!clinicId) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لم يتم تحديد العيادة",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { db } = getFirebase();
      const clinicRef = doc(db, 'clinics', clinicId);

      // Update clinic data (including settings)
      await updateDoc(clinicRef, {
        name: values.name,
        slug: values.slug,
        phoneNumbers: values.phoneNumbers ? values.phoneNumbers.split(',').map(p => p.trim()) : [],
        locations: values.locations ? values.locations.split(',').map(l => l.trim()) : [],
        settings: {
          consultationTime: values.consultationTime,
          consultationCost: values.consultationCost,
          reConsultationCost: values.reConsultationCost,
        },
        updatedAt: new Date(),
      });

      toast({
        title: "تم الحفظ",
        description: "تم تحديث إعدادات العيادة بنجاح",
      });
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل حفظ الإعدادات. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              معلومات الاتصال
            </CardTitle>
            <CardDescription>
              أرقام الهاتف والعناوين
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>أرقام الهاتف</FormLabel>
                  <FormControl>
                    <Input placeholder="01012345678, 01098765432" {...field} />
                  </FormControl>
                  <FormDescription>
                    افصل بين الأرقام بفاصلة (,)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="locations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العناوين</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="شارع التحرير، المنصورة، الدقهلية"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    افصل بين العناوين بفاصلة (,)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Consultation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              إعدادات الاستشارة
            </CardTitle>
            <CardDescription>
              الوقت والتكلفة للاستشارات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="consultationTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>متوسط وقت الاستشارة (دقيقة)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="15" {...field} />
                  </FormControl>
                  <FormDescription>
                    متوسط الوقت بالدقائق لاستشارة مريض واحد
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            
            <FormField
              control={form.control}
              name="consultationCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                   
                    تكلفة الاستشارة الجديدة (جنيه)
                  </FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50" {...field} />
                  </FormControl>
                  <FormDescription>
                    تكلفة استشارة المريض لأول مرة
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
                  <FormLabel className="flex items-center gap-2">
                    تكلفة إعادة الاستشارة (جنيه)
                  </FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="25" {...field} />
                  </FormControl>
                  <FormDescription>
                    تكلفة استشارة المريض المتكررة
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              "جاري الحفظ..."
            ) : (
              <>
                <Save className="ml-2 h-4 w-4" />
                حفظ التغييرات
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
