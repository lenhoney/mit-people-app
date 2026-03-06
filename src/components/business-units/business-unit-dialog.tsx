"use client";

import { useState, useEffect } from "react";
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

export interface BusinessUnitData {
  id?: number;
  short_name: string;
  registered_name: string;
  signatory_for_icm: string;
  manager_1: string;
  manager_2: string;
  registered_street_address: string;
  registered_city: string;
  registered_zipcode: string;
  registered_country: string;
  icm_signatory_name: string;
  icm_signatory_title: string;
  icm_contractual_address: string;
  icm_signatory_phone: string;
  icm_signatory_email: string;
  icm_billing_name: string;
  icm_billing_title: string;
  icm_billing_address: string;
  icm_billing_phone: string;
  icm_billing_email: string;
  created_at?: string;
  updated_at?: string;
}

interface BusinessUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessUnit: BusinessUnitData | null;
  onSave: () => void;
}

const emptyBusinessUnit: BusinessUnitData = {
  short_name: "",
  registered_name: "",
  signatory_for_icm: "",
  manager_1: "",
  manager_2: "",
  registered_street_address: "",
  registered_city: "",
  registered_zipcode: "",
  registered_country: "",
  icm_signatory_name: "",
  icm_signatory_title: "",
  icm_contractual_address: "",
  icm_signatory_phone: "",
  icm_signatory_email: "",
  icm_billing_name: "",
  icm_billing_title: "",
  icm_billing_address: "",
  icm_billing_phone: "",
  icm_billing_email: "",
};

export function BusinessUnitDialog({
  open,
  onOpenChange,
  businessUnit,
  onSave,
}: BusinessUnitDialogProps) {
  const [formData, setFormData] = useState<BusinessUnitData>(emptyBusinessUnit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!businessUnit?.id;

  useEffect(() => {
    if (businessUnit) {
      setFormData(businessUnit);
    } else {
      setFormData(emptyBusinessUnit);
    }
    setError("");
  }, [businessUnit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.short_name.trim()) {
      setError("Short name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing
        ? `/api/business-units/${businessUnit?.id}`
        : "/api/business-units";
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
        err instanceof Error ? err.message : "Failed to save business unit"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = (
    field: keyof BusinessUnitData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Business Unit" : "Add New Business Unit"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* General Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="short_name">Short Name *</Label>
                <Input
                  id="short_name"
                  value={formData.short_name}
                  onChange={(e) => updateField("short_name", e.target.value)}
                  placeholder="e.g. GEL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registered_name">Registered Name *</Label>
                <Input
                  id="registered_name"
                  value={formData.registered_name}
                  onChange={(e) =>
                    updateField("registered_name", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signatory_for_icm">Signatory for ICM *</Label>
                <Input
                  id="signatory_for_icm"
                  value={formData.signatory_for_icm}
                  onChange={(e) =>
                    updateField("signatory_for_icm", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_1">Manager 1 *</Label>
                <Input
                  id="manager_1"
                  value={formData.manager_1}
                  onChange={(e) => updateField("manager_1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_2">Manager 2</Label>
                <Input
                  id="manager_2"
                  value={formData.manager_2}
                  onChange={(e) => updateField("manager_2", e.target.value)}
                />
              </div>
            </div>

            <Separator label="Registered Address" />

            <div className="space-y-2">
              <Label htmlFor="registered_street_address">
                Street Address *
              </Label>
              <Input
                id="registered_street_address"
                value={formData.registered_street_address}
                onChange={(e) =>
                  updateField("registered_street_address", e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registered_city">City *</Label>
                <Input
                  id="registered_city"
                  value={formData.registered_city}
                  onChange={(e) =>
                    updateField("registered_city", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registered_zipcode">Zipcode *</Label>
                <Input
                  id="registered_zipcode"
                  value={formData.registered_zipcode}
                  onChange={(e) =>
                    updateField("registered_zipcode", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registered_country">Country *</Label>
                <Input
                  id="registered_country"
                  value={formData.registered_country}
                  onChange={(e) =>
                    updateField("registered_country", e.target.value)
                  }
                />
              </div>
            </div>

            <Separator label="ICM Signatory Details" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icm_signatory_name">Name *</Label>
                <Input
                  id="icm_signatory_name"
                  value={formData.icm_signatory_name}
                  onChange={(e) =>
                    updateField("icm_signatory_name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icm_signatory_title">Title *</Label>
                <Input
                  id="icm_signatory_title"
                  value={formData.icm_signatory_title}
                  onChange={(e) =>
                    updateField("icm_signatory_title", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icm_contractual_address">
                Contractual Address *
              </Label>
              <Input
                id="icm_contractual_address"
                value={formData.icm_contractual_address}
                onChange={(e) =>
                  updateField("icm_contractual_address", e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icm_signatory_phone">Phone *</Label>
                <Input
                  id="icm_signatory_phone"
                  value={formData.icm_signatory_phone}
                  onChange={(e) =>
                    updateField("icm_signatory_phone", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icm_signatory_email">Email *</Label>
                <Input
                  id="icm_signatory_email"
                  type="email"
                  value={formData.icm_signatory_email}
                  onChange={(e) =>
                    updateField("icm_signatory_email", e.target.value)
                  }
                />
              </div>
            </div>

            <Separator label="ICM Billing Details" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icm_billing_name">Name *</Label>
                <Input
                  id="icm_billing_name"
                  value={formData.icm_billing_name}
                  onChange={(e) =>
                    updateField("icm_billing_name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icm_billing_title">Title *</Label>
                <Input
                  id="icm_billing_title"
                  value={formData.icm_billing_title}
                  onChange={(e) =>
                    updateField("icm_billing_title", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icm_billing_address">Billing Address *</Label>
              <Input
                id="icm_billing_address"
                value={formData.icm_billing_address}
                onChange={(e) =>
                  updateField("icm_billing_address", e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icm_billing_phone">Phone *</Label>
                <Input
                  id="icm_billing_phone"
                  value={formData.icm_billing_phone}
                  onChange={(e) =>
                    updateField("icm_billing_phone", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icm_billing_email">Email *</Label>
                <Input
                  id="icm_billing_email"
                  type="email"
                  value={formData.icm_billing_email}
                  onChange={(e) =>
                    updateField("icm_billing_email", e.target.value)
                  }
                />
              </div>
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
