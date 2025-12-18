
"use client";

import { useEffect, useMemo, useState } from "react";
import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";
import { QrCodeDialog } from "./qr-code-dialog";
import { listenToQueueForNurse, type PatientInQueue, type QueueType } from "@/services/queueService";
import { Input } from "../ui/input";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useNurseProfile } from "./nurse-profile-provider";

export function NurseDashboardClient() {
    const { user, userProfile } = useNurseProfile();
    const [qrCodeData, setQrCodeData] = useState<PatientInQueue | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user || !userProfile) {
            console.warn('NurseDashboardClient: Missing user or userProfile', { user, userProfile });
            return;
        }

        // Get clinicId from userProfile (multi-tenant)
        const clinicId = 'clinicId' in userProfile ? userProfile.clinicId : undefined;
        if (!clinicId) {
            console.error('NurseDashboardClient: userProfile missing clinicId', { userProfile });
            return;
        }

        // Since nurse and doctor are the same user, we use the nurse's UID as the doctorId
        const doctorId = user.uid;

        console.log('Setting up queue listener for nurse:', {
            doctorId,
            clinicId,
            nurseId: 'nurseId' in userProfile ? userProfile.nurseId : undefined
        });

        const unsubscribe = listenToQueueForNurse(
            doctorId, 
            (updatedQueue) => {
                const activePatients = updatedQueue
                    .filter(p => p.status !== 'Finished')
                    .sort((a, b) => a.queueNumber - b.queueNumber);
                setPatients(activePatients);
                setIsLoading(false);
            },
            async (error) => {
                // Handle permission errors - user might be deactivated or not properly set up
                console.error('🚨 Queue listener error:', {
                    error: error.message,
                    code: (error as any).code,
                    userProfile: {
                        uid: user.uid,
                        clinicId: clinicId
                    }
                });
                
                if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
                    alert('⚠️ خطأ في الصلاحيات!\n\nيبدو أن حسابك غير مفعّل أو تم حذفه.\nسيتم تسجيل خروجك الآن.');
                    
                    // Force logout and redirect
                    const { signOutUser } = await import('@/services/authClientService');
                    await signOutUser();
                    window.location.href = '/login?message=لا توجد لديك صلاحيات للوصول إلى هذه الصفحة';
                }
            },
            clinicId  // Pass clinicId for multi-tenant filtering
        );
        return () => unsubscribe();
    }, [user, userProfile]);

    const handlePatientRegistered = (patient: PatientInQueue) => {
        setQrCodeData(patient);
    }

    const filterPatients = (queueType: QueueType) => {
        return patients.filter(p => (p.queueType || 'Consultation') === queueType);
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1">
                    <PatientRegistrationForm onPatientRegistered={handlePatientRegistered} />
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="البحث بالاسم، الهاتف، رقم الانتظار، أو التاريخ..."
                            className="pr-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Tabs defaultValue="consultation">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="consultation">قائمة الاستشارات</TabsTrigger>
                            <TabsTrigger value="re-consultation">قائمة إعادة الاستشارات</TabsTrigger>
                        </TabsList>
                        <TabsContent value="consultation">
                             <QueueList 
                                title="قائمة الاستشارات"
                                allPatients={patients}
                                queuePatients={filterPatients('Consultation')}
                                onShowQrCode={setQrCodeData} 
                                searchQuery={searchQuery}
                                isLoading={isLoading}
                            />
                        </TabsContent>
                        <TabsContent value="re-consultation">
                             <QueueList 
                                title="قائمة إعادة الاستشارات"
                                allPatients={patients}
                                queuePatients={filterPatients('Re-consultation')}
                                onShowQrCode={setQrCodeData} 
                                searchQuery={searchQuery}
                                isLoading={isLoading}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <QrCodeDialog 
                patient={qrCodeData}
                isOpen={!!qrCodeData}
                onClose={() => setQrCodeData(null)}
            />
        </>
    );
}
