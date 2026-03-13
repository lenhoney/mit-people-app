"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BusinessUnitsTable } from "@/components/business-units/business-units-table";
import {
  BusinessUnitDialog,
  BusinessUnitData,
} from "@/components/business-units/business-unit-dialog";
import { Building2 } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-provider";

export default function BusinessUnitsPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BusinessUnitData | null>(null);
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const loadBusinessUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/business-units");
      if (!res.ok) { setBusinessUnits([]); return; }
      const data = await res.json();
      setBusinessUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load business units:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessUnits();
  }, [loadBusinessUnits]);

  const handleEdit = (bu: BusinessUnitData) => {
    setEditingUnit(bu);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingUnit(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this business unit? People assigned to this unit will have their business unit cleared."
      )
    )
      return;

    try {
      const res = await fetch(`/api/business-units/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadBusinessUnits();
      }
    } catch (err) {
      console.error("Failed to delete business unit:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Business Units</h1>
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
          <h1 className="text-3xl font-bold">Business Units</h1>
          <p className="text-muted-foreground mt-1">
            Manage your business units
          </p>
        </div>
        {canCreate("business-units") && (
          <Button onClick={handleAdd}>
            <Building2 className="h-4 w-4 mr-2" />
            Add Business Unit
          </Button>
        )}
      </div>

      <BusinessUnitsTable
        businessUnits={businessUnits}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canUpdate("business-units")}
        canDelete={canDelete("business-units")}
      />

      <BusinessUnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        businessUnit={editingUnit}
        onSave={loadBusinessUnits}
      />
    </div>
  );
}
