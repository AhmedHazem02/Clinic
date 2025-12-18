
import { PatientSearchForm } from "@/components/patient-search-form";
import { Stethoscope, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
            <Stethoscope className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            عيادة QueueWise
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            احجز موعدك أو تابع حالة حجزك بسهولة
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Book Appointment Card */}
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader className="text-center">
              <div className="inline-flex justify-center mb-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">احجز موعد جديد</CardTitle>
              <CardDescription className="text-base">
                سجل بياناتك واحجز موعدك مع الطبيب
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/book">
                <Button className="w-full" size="lg">
                  احجز الآن
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Check Status Card */}
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader className="text-center">
              <div className="inline-flex justify-center mb-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Search className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">تحقق من موعدك</CardTitle>
              <CardDescription className="text-base">
                ادخل رقم الهاتف لمتابعة حالة حجزك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatientSearchForm />
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center text-sm text-muted-foreground">
          <p>هل أنت من فريق العمل؟ <a href="/login" className="font-medium text-primary hover:underline">سجل الدخول من هنا</a></p>
        </div>
      </div>
    </main>
  );
}
