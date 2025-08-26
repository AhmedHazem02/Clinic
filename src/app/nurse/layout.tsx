import { NurseHeader } from "@/components/nurse/nurse-header";
import { NurseProfileProvider } from "@/components/nurse/nurse-profile-provider";

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NurseProfileProvider>
      <NurseHeader />
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-0">
        {children}
      </main>
    </NurseProfileProvider>
  );
}
