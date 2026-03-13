"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientDialog, ClientData } from "@/components/clients/client-dialog";
import { Handshake } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-provider";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) { setClients([]); return; }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleEdit = (client: ClientData) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this client? Projects linked to this client will have their client cleared."
      )
    )
      return;

    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadClients();
      }
    } catch (err) {
      console.error("Failed to delete client:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Clients</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your clients
          </p>
        </div>
        {canCreate("clients") && (
          <Button onClick={handleAdd}>
            <Handshake className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        )}
      </div>

      <ClientsTable
        clients={clients}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canUpdate("clients")}
        canDelete={canDelete("clients")}
      />

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onSave={loadClients}
      />
    </div>
  );
}
