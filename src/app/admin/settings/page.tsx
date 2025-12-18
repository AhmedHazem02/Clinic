import { ClinicSettingsForm } from "@/components/admin/clinic-settings-form";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إعدادات العيادة</h1>
        <p className="text-muted-foreground">
          إدارة معلومات العيادة، جهات الاتصال، والأسعار
        </p>
      </div>
      <ClinicSettingsForm />
    </div>
  );
}
