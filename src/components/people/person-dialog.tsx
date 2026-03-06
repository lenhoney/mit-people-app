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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, X, Plus } from "lucide-react";

interface Country {
  id: number;
  name: string;
  code: string;
}

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function getDaysForMonth(month: string): string[] {
  const daysInMonth: Record<string, number> = {
    "01": 31, "02": 29, "03": 31, "04": 30,
    "05": 31, "06": 30, "07": 31, "08": 31,
    "09": 30, "10": 31, "11": 30, "12": 31,
  };
  const max = daysInMonth[month] || 31;
  return Array.from({ length: max }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
}

export interface PersonData {
  id?: number;
  person: string;
  sow: string;
  role: string;
  rate: number | null;
  fy_label: string | null;
  kerb: string;
  managed_services: number;
  architecture: number;
  app_support: number;
  computing: number;
  phone: string;
  work_anniversary: string;
  birthday: string;
  manager_name: string;
  business_unit: string;
  status: string;
  photo: string | null;
  country: string;
}

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonData | null;
  onSave: () => void;
}

const emptyPerson: PersonData = {
  person: "",
  sow: "",
  role: "",
  rate: null,
  fy_label: null,
  kerb: "",
  managed_services: 0,
  architecture: 0,
  app_support: 0,
  computing: 0,
  phone: "",
  work_anniversary: "",
  birthday: "",
  manager_name: "",
  business_unit: "",
  status: "Active",
  photo: null,
  country: "South Africa",
};

export function PersonDialog({ open, onOpenChange, person, onSave }: PersonDialogProps) {
  const [formData, setFormData] = useState<PersonData>(emptyPerson);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [businessUnits, setBusinessUnits] = useState<{ id: number; short_name: string }[]>([]);
  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryCode, setNewCountryCode] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!person?.id;

  useEffect(() => {
    if (person) {
      setFormData(person);
      setPhotoPreview(person.photo ? `/api/photos/${person.photo}` : null);
    } else {
      setFormData(emptyPerson);
      setPhotoPreview(null);
    }
    setError("");
  }, [person, open]);

  useEffect(() => {
    fetch("/api/countries")
      .then((res) => res.json())
      .then((data) => setCountries(data))
      .catch(() => {});
    fetch("/api/business-units")
      .then((res) => res.json())
      .then((data) => setBusinessUnits(data))
      .catch(() => {});
  }, []);

  const handleAddCountry = async () => {
    if (!newCountryName.trim() || !newCountryCode.trim()) return;
    try {
      const res = await fetch("/api/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCountryName.trim(), code: newCountryCode.trim().toUpperCase() }),
      });
      if (res.ok) {
        const updated = await fetch("/api/countries").then((r) => r.json());
        setCountries(updated);
        updateField("country", newCountryName.trim());
        setNewCountryName("");
        setNewCountryCode("");
        setAddingCountry(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add country");
      }
    } catch {
      setError("Failed to add country");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.id) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);

      const res = await fetch(`/api/people/${formData.id}/photo`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload photo");
      }

      const data = await res.json();
      setFormData((prev) => ({ ...prev, photo: data.photo }));
      setPhotoPreview(`/api/photos/${data.photo}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    if (!formData.id) return;
    setUploading(true);
    try {
      await fetch(`/api/people/${formData.id}/photo`, { method: "DELETE" });
      setFormData((prev) => ({ ...prev, photo: null }));
      setPhotoPreview(null);
    } catch {
      setError("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.person.trim()) {
      setError("Person name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/people/${person?.id}` : "/api/people";
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
      setError(err instanceof Error ? err.message : "Failed to save person");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof PersonData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const birthdayMonth = formData.birthday ? formData.birthday.split("-")[0] : "";
  const birthdayDay = formData.birthday ? formData.birthday.split("-")[1] : "";

  const handleBirthdayChange = (field: "month" | "day", value: string) => {
    if (field === "month") {
      if (!value) {
        updateField("birthday", "");
      } else {
        updateField("birthday", `${value}-${birthdayDay || "01"}`);
      }
    } else {
      if (birthdayMonth) {
        updateField("birthday", `${birthdayMonth}-${value}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Person" : "Add New Person"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Photo upload */}
            {isEditing && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt={formData.person}
                        className="w-16 h-16 rounded-full object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={handlePhotoRemove}
                        disabled={uploading}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? "Uploading..." : photoPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF. Max 5MB.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="person">Name *</Label>
                <Input
                  id="person"
                  value={formData.person}
                  onChange={(e) => updateField("person", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || "Active"}
                  onValueChange={(val) => updateField("status", val)}
                >
                  <SelectTrigger
                    className={
                      (formData.status || "Active") === "Not Active"
                        ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                        : ""
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Not Active">Not Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kerb">Kerb ID</Label>
                <Input
                  id="kerb"
                  value={formData.kerb || ""}
                  onChange={(e) => updateField("kerb", e.target.value)}
                  placeholder="Kerberos ID"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={formData.role || ""}
                  onChange={(e) => updateField("role", e.target.value)}
                  placeholder="Role at MIT"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow">SOW</Label>
                <Input
                  id="sow"
                  value={formData.sow || ""}
                  onChange={(e) => updateField("sow", e.target.value)}
                  placeholder="Statement of Work"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate (USD/hr)</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm">
                  {formData.rate ? `$${formData.rate.toFixed(2)}` : "—"}
                  {formData.fy_label && (
                    <span className="ml-2 text-xs text-muted-foreground">({formData.fy_label})</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Rates are imported via the Upload Rates spreadsheet</p>
              </div>
            </div>

            <Separator label="Personal Details" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_name">Manager</Label>
                <Input
                  id="manager_name"
                  value={formData.manager_name || ""}
                  onChange={(e) => updateField("manager_name", e.target.value)}
                  placeholder="Manager name"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                {addingCountry ? (
                  <div className="flex gap-1">
                    <Input
                      value={newCountryName}
                      onChange={(e) => setNewCountryName(e.target.value)}
                      placeholder="Name"
                      className="h-9 flex-1"
                    />
                    <Input
                      value={newCountryCode}
                      onChange={(e) => setNewCountryCode(e.target.value)}
                      placeholder="Code"
                      className="h-9 w-[60px]"
                      maxLength={2}
                    />
                    <Button type="button" size="sm" className="h-9 px-2" onClick={handleAddCountry}>
                      Add
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={() => setAddingCountry(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Select
                      value={formData.country || ""}
                      onValueChange={(val) => updateField("country", val)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            <span className="inline-flex items-center gap-2">
                              <img
                                src={`https://flagcdn.com/16x12/${c.code.toLowerCase()}.png`}
                                alt=""
                                className="w-4 h-3"
                              />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => setAddingCountry(true)}
                      title="Add new country"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Birthday</Label>
                <div className="flex gap-1.5">
                  <Select
                    value={birthdayMonth}
                    onValueChange={(val) => handleBirthdayChange("month", val)}
                  >
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue placeholder="Month">
                        {birthdayMonth
                          ? MONTHS.find((m) => m.value === birthdayMonth)?.label.slice(0, 3)
                          : "Month"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={birthdayDay}
                    onValueChange={(val) => handleBirthdayChange("day", val)}
                  >
                    <SelectTrigger className="w-[60px] flex-shrink-0">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {getDaysForMonth(birthdayMonth || "01").map((d) => (
                        <SelectItem key={d} value={d}>
                          {parseInt(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_anniversary">Work Anniversary</Label>
                <Input
                  id="work_anniversary"
                  type="date"
                  value={formData.work_anniversary || ""}
                  onChange={(e) => updateField("work_anniversary", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_unit">Business Unit</Label>
                <Select
                  value={formData.business_unit || ""}
                  onValueChange={(val) => updateField("business_unit", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.id} value={bu.short_name}>
                        {bu.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator label="Team Assignments" />

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "managed_services" as const, label: "Managed Services" },
                { key: "architecture" as const, label: "Architecture" },
                { key: "app_support" as const, label: "App Support" },
                { key: "computing" as const, label: "Computing" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData[key]}
                    onChange={(e) => updateField(key, e.target.checked ? 1 : 0)}
                    className="rounded border-input h-4 w-4"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}
