"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";

export interface ClientData {
  id?: number;
  name: string;
  short_name: string;
  contact_person: string;
  contact_email: string;
  logo: string | null;
  business_unit_ids: number[];
  business_units?: string[];
  created_at?: string;
  updated_at?: string;
}

interface BusinessUnit {
  id: number;
  short_name: string;
  registered_name: string;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientData | null;
  onSave: () => void;
}

const emptyClient: ClientData = {
  name: "",
  short_name: "",
  contact_person: "",
  contact_email: "",
  logo: null,
  business_unit_ids: [],
};

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSave,
}: ClientDialogProps) {
  const [formData, setFormData] = useState<ClientData>(emptyClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!client?.id;

  useEffect(() => {
    if (client) {
      // Ensure business_unit_ids is always an array when setting from API data
      setFormData({ ...client, business_unit_ids: client.business_unit_ids ?? [] });
      setLogoPreview(client.logo ? `/api/client-logos/${client.logo}` : null);
    } else {
      setFormData(emptyClient);
      setLogoPreview(null);
    }
    setError("");
  }, [client, open]);

  useEffect(() => {
    fetch("/api/business-units")
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => setBusinessUnits(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Sync business_unit_ids from business_units names when editing
  useEffect(() => {
    if (
      client?.business_units &&
      client.business_units.length > 0 &&
      businessUnits.length > 0 &&
      formData.business_unit_ids.length === 0
    ) {
      const ids = businessUnits
        .filter((bu) => client.business_units!.includes(bu.short_name))
        .map((bu) => bu.id);
      setFormData((prev) => ({ ...prev, business_unit_ids: ids }));
    }
  }, [client, businessUnits, formData.business_unit_ids.length]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.id) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);

      const res = await fetch(`/api/clients/${formData.id}/logo`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload logo");
      }

      const data = await res.json();
      setFormData((prev) => ({ ...prev, logo: data.logo }));
      setLogoPreview(`/api/client-logos/${data.logo}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoRemove = async () => {
    if (!formData.id) return;
    setUploading(true);
    try {
      await fetch(`/api/clients/${formData.id}/logo`, { method: "DELETE" });
      setFormData((prev) => ({ ...prev, logo: null }));
      setLogoPreview(null);
    } catch {
      setError("Failed to remove logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.short_name.trim()) {
      setError("Short name is required");
      return;
    }
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing
        ? `/api/clients/${client?.id}`
        : "/api/clients";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      onSave();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save client"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ClientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleBusinessUnit = (buId: number) => {
    setFormData((prev) => {
      const ids = prev.business_unit_ids.includes(buId)
        ? prev.business_unit_ids.filter((id) => id !== buId)
        : [...prev.business_unit_ids, buId];
      return { ...prev, business_unit_ids: ids };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Client" : "Add New Client"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Logo upload - only when editing */}
            {isEditing && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Client logo"
                        className="w-16 h-16 rounded-lg object-contain bg-white/10 border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        disabled={uploading}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border border-white/10">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, WebP, GIF (max 5MB)
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="short_name">Short Name *</Label>
                <Input
                  id="short_name"
                  value={formData.short_name}
                  onChange={(e) => updateField("short_name", e.target.value)}
                  placeholder="e.g. MIT"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. Massachusetts Institute of Technology"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person *</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) =>
                    updateField("contact_person", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    updateField("contact_email", e.target.value)
                  }
                />
              </div>
            </div>

            <Separator label="Business Units" />

            <div className="flex flex-wrap gap-2">
              {businessUnits.map((bu) => {
                const isSelected = formData.business_unit_ids.includes(bu.id);
                return (
                  <button
                    key={bu.id}
                    type="button"
                    onClick={() => toggleBusinessUnit(bu.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {bu.short_name}
                  </button>
                );
              })}
              {businessUnits.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No business units found
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="h-px bg-border flex-1" />
      <span className="text-xs text-muted-foreground font-medium">
        {label}
      </span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}
