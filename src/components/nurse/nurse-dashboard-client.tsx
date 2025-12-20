
"use client";

import { useEffect, useMemo, useState } from "react";
import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";
import { QrCodeDialog } from "./qr-code-dialog";
import { listenToQueueForNurse, listenToClinicQueue, getClinicDoctors, type PatientInQueue, type QueueType } from "@/services/queueService";
import { Input } from "../ui/input";
import { Search, Stethoscope } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useNurseProfile } from "./nurse-profile-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";

export function NurseDashboardClient() {
    const { user, userProfile } = useNurseProfile();
    const [qrCodeData, setQrCodeData] = useState<PatientInQueue | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState<PatientInQueue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [doctors, setDoctors] = useState<{ id: string; name: string; specialty: string }[]>([]);
    const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>("all");

    // Load clinic doctors for filter dropdown
    useEffect(() => {
        async function loadClinicDoctors() {
            if (!userProfile) return;

            const clinicId = 'clinicId' in userProfile ? userProfile.clinicId : undefined;
            if (!clinicId) return;

            try {
                const clinicDoctors = await getClinicDoctors(clinicId);
                setDoctors(clinicDoctors.filter(d => d.isActive));
            } catch (error) {
                console.error('Error loading clinic doctors:', error);
            }
        }

        loadClinicDoctors();
    }, [userProfile]);

    // Queue listener - filter by nurse's assigned doctor
    useEffect(() => {
        if (!user || !userProfile) {
            console.warn('NurseDashboardClient: Missing user or userProfile', { user, userProfile });
            return;
        }

        // Get clinicId and doctorId from userProfile (multi-tenant)
        const clinicId = 'clinicId' in userProfile ? userProfile.clinicId : undefined;
        const nurseDoctorId = 'doctorId' in userProfile ? userProfile.doctorId : undefined;

        if (!clinicId) {
            console.error('NurseDashboardClient: userProfile missing clinicId', { userProfile });
            // Fallback to legacy doctor-specific queue for backward compatibility
            const doctorId = user.uid;
            const unsubscribe = listenToQueueForNurse(
                doctorId,
                (updatedQueue) => {
                    // Show all patients including finished ones
                    const allPatients = updatedQueue
                        .sort((a, b) => a.queueNumber - b.queueNumber);
                    setPatients(allPatients);
                    setIsLoading(false);
                },
                async (error) => {
                    console.error('🚨 Queue listener error:', error);
                    if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
                        alert('⚠️ خطأ في الصلاحيات!\n\nيبدو أن حسابك غير مفعّل أو تم حذفه.\nسيتم تسجيل خروجك الآن.');
                        const { signOutUser } = await import('@/services/authClientService');
                        await signOutUser();
                        window.location.href = '/login?message=لا توجد لديك صلاحيات للوصول إلى هذه الصفحة';
                    }
                }
            );
            return () => unsubscribe();
        }

        console.log('Setting up queue listener for nurse:', {
            clinicId,
            nurseDoctorId,
            nurseId: user.uid
        });

        // Use clinic-wide queue listener filtered by nurse's assigned doctor
        const unsubscribe = listenToClinicQueue(
            clinicId,
            (updatedQueue) => {
                // Show all patients (including Finished) and sort by queue number
                const allPatients = updatedQueue
                    .sort((a, b) => a.queueNumber - b.queueNumber);
                setPatients(allPatients);
                setIsLoading(false);
            },
            async (error) => {
                console.error('🚨 Clinic queue listener error:', {
                    error: error.message,
                    code: (error as any).code,
                    userProfile: {
                        uid: user.uid,
                        clinicId: clinicId,
                        doctorId: nurseDoctorId
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
            {
                doctorId: nurseDoctorId, // FIXED: Filter by nurse's assigned doctor!
                includeFinished: true // Show all patients including finished ones
            }
        );
        return () => unsubscribe();
    }, [user, userProfile]);

    const handlePatientRegistered = (patient: PatientInQueue) => {
        setQrCodeData(patient);
    }

    const filterPatients = (queueType: QueueType) => {
        let filtered = patients.filter(p => (p.queueType || 'Consultation') === queueType);

        // Apply doctor filter if not "all"
        if (selectedDoctorFilter !== "all") {
            filtered = filtered.filter(p => p.doctorId === selectedDoctorFilter);
        }

        return filtered;
    };

    // Get doctor name by doctorId (used in queue list)
    const getDoctorName = (doctorId: string) => {
        const doctor = doctors.find(d => d.id === doctorId);
        return doctor ? `${doctor.name}` : 'غير معروف';
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
                    {/* Doctor Filter - Only show if clinic has multiple doctors */}
                    {doctors.length > 1 && (
                        <div className="space-y-2">
                            <Label htmlFor="doctorFilter" className="flex items-center gap-2">
                                <Stethoscope className="h-4 w-4" />
                                تصفية حسب الطبيب
                            </Label>
                            <Select
                                value={selectedDoctorFilter}
                                onValueChange={setSelectedDoctorFilter}
                            >
                                <SelectTrigger id="doctorFilter">
                                    <SelectValue placeholder="كل الأطباء" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الأطباء</SelectItem>
                                    {doctors.map((doctor) => (
                                        <SelectItem key={doctor.id} value={doctor.id}>
                                            {doctor.name} - {doctor.specialty}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
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
                                showDoctorColumn={doctors.length > 1}
                                getDoctorName={getDoctorName}
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
                                showDoctorColumn={doctors.length > 1}
                                getDoctorName={getDoctorName}
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
