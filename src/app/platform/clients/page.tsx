"use client";

/**
 * Platform Admin: Clients Management Page
 * 
 * Allows platform super admins to:
 * - View all clinic clients
 * - Create new clients
 * - Suspend/Reactivate/Cancel clients
 * - Generate password reset links for owners
 * 
 * Route: /platform/clients
 * Authorization: Platform Admin only
 * 
 * Architecture:
 * - Uses Firebase Auth only for getIdToken()
 * - All data operations via /api/platform/* routes (Firebase Admin SDK)
 * - NO direct Firestore client access to platformClients collection
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebase } from "@/lib/firebase";
import { isPlatformAdmin } from "@/services/platformAdminService";
import { PlatformClient } from "@/types/multitenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Copy, Ban, PlayCircle, XCircle, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PlatformClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Create form state
  const [ownerEmail, setOwnerEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicSlug, setClinicSlug] = useState("");
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  // Get auth token for API calls
  const getAuthToken = async () => {
    const user = getFirebase().auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  // Load clients from API (Admin SDK)
  const loadClientsFromAPI = async () => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch("/api/platform/clients", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load clients");
      }

      setClients(data.clients || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load clients",
        variant: "destructive",
      });
    }
  };

  // Check authorization via server API
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebase().auth, async (user) => {
      if (!user) {
        router.push("/platform/login");
        return;
      }

      try {
        // Verify platform admin via server API
        const token = await user.getIdToken();
        const response = await fetch("/api/platform/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await response.json();
        
        if (!data.isPlatformAdmin) {
          // Not a platform admin: redirect to platform login
          router.push("/platform/login?message=غير مصرح: أنت لست مسؤول منصة");
          return;
        }

        // Authorized
        setAuthorized(true);
        setLoading(false);
      } catch (error) {
        console.error("Authorization error:", error);
        router.push("/platform/login?message=فشل التحقق من الصلاحيات");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Load clients when authorized
  useEffect(() => {
    if (!authorized) return;
    loadClientsFromAPI();
  }, [authorized]);

  // Create client
  const handleCreateClient = async () => {
    if (!ownerEmail || !clinicName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const token = await getAuthToken();
      
      const response = await fetch("/api/platform/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerEmail,
          clinicName,
          clinicSlug: clinicSlug || undefined,
          plan: plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create client");
      }

      toast({
        title: "Success",
        description: "Client created successfully!",
      });

      // Copy reset link to clipboard
      if (data.resetLink) {
        try {
          await navigator.clipboard.writeText(data.resetLink);
          toast({
            title: "Activation Link Copied",
            description: "Password reset link copied to clipboard",
          });
        } catch (clipboardError) {
          // Clipboard failed, show the link in toast instead
          console.warn("Clipboard error:", clipboardError);
          toast({
            title: "Activation Link Generated",
            description: `Link: ${data.resetLink.substring(0, 50)}...`,
            duration: 10000,
          });
        }
      }

      // Reset form and close modal
      setOwnerEmail("");
      setClinicName("");
      setClinicSlug("");
      setPlan("monthly");
      setCreateModalOpen(false);

      // Reload clients from API
      await loadClientsFromAPI();

    } catch (error) {
      console.error("Error creating client:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Get reset link
  const handleGetResetLink = async (clientId: string) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/platform/clients/${clientId}/reset-link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get reset link");
      }

      await navigator.clipboard.writeText(data.resetLink);
      toast({
        title: "Link Copied",
        description: "Password reset link copied to clipboard",
      });

    } catch (error) {
      console.error("Error getting reset link:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get reset link",
        variant: "destructive",
      });
    }
  };

  // Suspend client
  const handleSuspendClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to suspend this client? All users will be disabled.")) {
      return;
    }

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/platform/clients/${clientId}/suspend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to suspend client");
      }

      toast({
        title: "Success",
        description: "Client suspended successfully",
      });

      // Reload clients
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: "suspended" } : c))
      );

    } catch (error) {
      console.error("Error suspending client:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suspend client",
        variant: "destructive",
      });
    }
  };

  // Reactivate client
  const handleReactivateClient = async (clientId: string) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/platform/clients/${clientId}/reactivate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reactivate client");
      }

      toast({
        title: "Success",
        description: "Client reactivated successfully",
      });

      // Reload clients
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: "active" } : c))
      );

    } catch (error) {
      console.error("Error reactivating client:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate client",
        variant: "destructive",
      });
    }
  };

  // Cancel client
  const handleCancelClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to CANCEL this client? This action is permanent.")) {
      return;
    }

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/platform/clients/${clientId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel client");
      }

      toast({
        title: "Success",
        description: "Client canceled successfully",
      });

      // Reload clients
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: "canceled" } : c))
      );

    } catch (error) {
      console.error("Error canceling client:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel client",
        variant: "destructive",
      });
    }
  };

  // Delete client permanently
  const handleDeleteClient = async (clientId: string) => {
    const confirmed = confirm(
      "⚠️ هل أنت متأكد من المسح التام؟\n\nهذا الإجراء نهائي ولا يمكن التراجع عنه.\nسيتم حذف:\n- العيادة\n- جميع المستخدمين\n- جميع البيانات\n\nاكتب 'DELETE' للتأكيد:"
    );
    
    if (!confirmed) return;

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/platform/clients/${clientId}/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete client");
      }

      toast({
        title: "Success",
        description: "Client deleted permanently",
      });

      // Remove from list
      setClients((prev) => prev.filter((c) => c.id !== clientId));

    } catch (error) {
      console.error("Error deleting client:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "suspended":
        return <Badge className="bg-orange-500">Suspended</Badge>;
      case "canceled":
        return <Badge className="bg-red-500">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (date: unknown) => {
    if (!date) return "N/A";
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'object' && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
      d = (date as { toDate: () => Date }).toDate();
    } else {
      return "N/A";
    }
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Clients</h1>
          <p className="text-gray-600 mt-1">Manage clinic customers and subscriptions</p>
        </div>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
              <DialogDescription>
                Create a new clinic with owner account. A password reset link will be generated.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="ownerEmail">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="owner@example.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="clinicName">Clinic Name *</Label>
                <Input
                  id="clinicName"
                  placeholder="My Clinic"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="clinicSlug">Clinic Slug (optional)</Label>
                <Input
                  id="clinicSlug"
                  placeholder="my-clinic"
                  value={clinicSlug}
                  onChange={(e) => setClinicSlug(e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Leave empty to auto-generate from clinic name
                </p>
              </div>
              
              <div>
                <Label htmlFor="plan">Subscription Plan *</Label>
                <Select value={plan} onValueChange={(value: "monthly" | "yearly") => setPlan(value)}>
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                onClick={handleCreateClient}
                disabled={creating}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No clients yet</p>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => (
                <Card key={client.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-lg font-semibold">{client.clinicName}</h3>
                          <p className="text-sm text-gray-600">/{client.clinicSlug}</p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div><span className="font-medium">Owner:</span> {client.ownerEmail}</div>
                          <div><span className="font-medium">Plan:</span> {client.plan}</div>
                          <div className="flex items-center gap-2"><span className="font-medium">Status:</span> <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge></div>
                          <div className="text-xs text-gray-500">Created: {formatDate(client.createdAt)}</div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => client.id && handleGetResetLink(client.id)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Reset Link
                        </Button>
                        
                        {client.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => client.id && handleSuspendClient(client.id)}
                          >
                            <Ban className="mr-1 h-3 w-3" />
                            Suspend
                          </Button>
                        )}
                        
                        {client.status === "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => client.id && handleReactivateClient(client.id)}
                          >
                            <PlayCircle className="mr-1 h-3 w-3" />
                            Reactivate
                          </Button>
                        )}
                        
                        {client.status !== "canceled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => client.id && handleCancelClient(client.id)}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => client.id && handleDeleteClient(client.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
