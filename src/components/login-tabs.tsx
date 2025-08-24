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
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm({ role }: { role: 'Doctor' | 'Nurse' }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

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
                title: "Login Failed",
                description: error.message || "An unexpected error occurred.",
            })
        } finally {
            setIsLoading(false);
        }
    };
    
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
        <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-email`}>Email</Label>
            <Input 
                id={`${role.toLowerCase()}-email`} 
                type="email" 
                placeholder="m@example.com" 
                {...form.register("email")}
            />
             {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-password`}>Password</Label>
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
            {isLoading ? `Logging in as ${role}...` : `Login as ${role}`}
        </Button>
        </CardFooter>
    </form>
  );
}

export function LoginTabs() {
  return (
    <Tabs defaultValue="doctor" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="doctor">Doctor</TabsTrigger>
        <TabsTrigger value="nurse">Nurse</TabsTrigger>
      </TabsList>
      <Card>
        <TabsContent value="doctor">
          <CardHeader>
            <CardTitle className="font-headline">Doctor Login</CardTitle>
            <CardDescription>
              Access your dashboard to manage patients and prescriptions.
            </CardDescription>
          </CardHeader>
          <LoginForm role="Doctor" />
        </TabsContent>
        <TabsContent value="nurse">
          <CardHeader>
            <CardTitle className="font-headline">Nurse Login</CardTitle>
            <CardDescription>
              Access the panel to manage the patient queue.
            </CardDescription>
          </CardHeader>
          <LoginForm role="Nurse" />
        </TabsContent>
      </Card>
    </Tabs>
  );
}
