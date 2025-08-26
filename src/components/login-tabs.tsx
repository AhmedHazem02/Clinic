
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signInUser } from "@/services/authClientService";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("الرجاء إدخال عنوان بريد إلكتروني صالح."),
  password: z.string().min(6, "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm({ role }: { role: 'Doctor' | 'Nurse' }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const roleInArabic = role === 'Doctor' ? 'الطبيب' : 'الممرضة';

    const form = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema),
      defaultValues: {
        email: "",
        password: "",
      }
    });

    const handleSubmit = async (values: LoginFormValues) => {
        setIsLoading(true);
        try {
            await signInUser(values.email, values.password);
            
            // Mock role-based redirection
            if (role === 'Doctor') {
                router.push('/doctor/dashboard');
            } else {
                router.push('/nurse/dashboard');
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "فشل تسجيل الدخول",
                description: error.message || "حدث خطأ غير متوقع.",
            })
        } finally {
            setIsLoading(false);
        }
    };
    
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
        <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-email`}>البريد الإلكتروني</Label>
            <Input 
                id={`${role.toLowerCase()}-email`} 
                type="email" 
                placeholder="m@example.com" 
                {...form.register("email")}
            />
             {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-password`}>كلمة المرور</Label>
            <Input 
                id={`${role.toLowerCase()}-password`} 
                type="password" 
                {...form.register("password")}
            />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
        </div>
        </CardContent>
        <CardFooter>
        <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? `جاري تسجيل الدخول كـ ${roleInArabic}...` : `تسجيل الدخول كـ ${roleInArabic}`}
        </Button>
        </CardFooter>
    </form>
  );
}

export function LoginTabs() {
  return (
    <Tabs defaultValue="doctor" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="doctor">طبيب</TabsTrigger>
        <TabsTrigger value="nurse">ممرضة</TabsTrigger>
      </TabsList>
      <Card>
        <TabsContent value="doctor">
          <CardHeader>
            <CardTitle className="font-headline">تسجيل دخول الطبيب</CardTitle>
            <CardDescription>
              الوصول إلى لوحة التحكم الخاصة بك لإدارة المرضى والوصفات الطبية.
            </CardDescription>
          </CardHeader>
          <LoginForm role="Doctor" />
        </TabsContent>
        <TabsContent value="nurse">
          <CardHeader>
            <CardTitle className="font-headline">تسجيل دخول الممرضة</CardTitle>
            <CardDescription>
              الوصول إلى اللوحة لإدارة قائمة انتظار المرضى.
            </CardDescription>
          </CardHeader>
          <LoginForm role="Nurse" />
        </TabsContent>
      </Card>
    </Tabs>
  );
}
