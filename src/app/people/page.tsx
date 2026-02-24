"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PeopleTable } from "@/components/people/people-table";
import { PersonDialog, PersonData } from "@/components/people/person-dialog";
import { PeopleUploadDialog } from "@/components/people/upload-dialog";
import { UserPlus, Upload } from "lucide-react";

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonData | null>(null);

  const loadPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      setPeople(data);
    } catch (err) {
      console.error("Failed to load people:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleEdit = (person: PersonData) => {
    setEditingPerson(person);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingPerson(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this person?")) return;

    try {
      const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadPeople();
      }
    } catch (err) {
      console.error("Failed to delete person:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">People</h1>
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
          <h1 className="text-3xl font-bold">People</h1>
          <p className="text-muted-foreground mt-1">
            Manage Epi-Use consultants on the MIT contract
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Rates
          </Button>
          <Button onClick={handleAdd}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Person
          </Button>
        </div>
      </div>

      <PeopleTable
        people={people}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <PersonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        person={editingPerson}
        onSave={loadPeople}
      />

      <PeopleUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={loadPeople}
      />
    </div>
  );
}
