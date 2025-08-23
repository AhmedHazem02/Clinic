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

function LoginForm({ role }: { role: 'Doctor' | 'Nurse' }) {
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock login logic
        if (role === 'Doctor') {
            router.push('/doctor/dashboard');
        } else {
            router.push('/nurse/dashboard');
        }
    };
    
  return (
    <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-email`}>Email</Label>
            <Input id={`${role.toLowerCase()}-email`} type="email" placeholder="m@example.com" required />
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${role.toLowerCase()}-password`}>Password</Label>
            <Input id={`${role.toLowerCase()}-password`} type="password" required />
        </div>
        </CardContent>
        <CardFooter>
        <Button className="w-full" type="submit">Login as {role}</Button>
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
