"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ArrowUpDown, Search, User } from "lucide-react";
import { PersonData } from "./person-dialog";

interface PeopleTableProps {
  people: PersonData[];
  onEdit: (person: PersonData) => void;
  onDelete: (id: number) => void;
}

type SortField = "person" | "role" | "sow" | "rate" | "business_unit";
type SortDir = "asc" | "desc";

function CountryFlag({ country, countryCodeMap }: { country: string | undefined; countryCodeMap: Record<string, string> }) {
  if (!country) return null;
  const code = countryCodeMap[country];
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/20x15/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/40x30/${code.toLowerCase()}.png 2x`}
      alt={country}
      title={country}
      className="w-5 h-[15px] flex-shrink-0 rounded-[2px]"
    />
  );
}

export function PeopleTable({ people, onEdit, onDelete }: PeopleTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("person");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [countryCodeMap, setCountryCodeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/countries")
      .then((res) => res.json())
      .then((data: { name: string; code: string }[]) => {
        const map: Record<string, string> = {};
        for (const c of data) map[c.name] = c.code;
        setCountryCodeMap(map);
      })
      .catch(() => {});
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = people;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.person.toLowerCase().includes(lower) ||
          (p.role && p.role.toLowerCase().includes(lower)) ||
          (p.sow && p.sow.toLowerCase().includes(lower)) ||
          (p.kerb && p.kerb.toLowerCase().includes(lower)) ||
          (p.business_unit && p.business_unit.toLowerCase().includes(lower)) ||
          (p.country && p.country.toLowerCase().includes(lower)) ||
          (p.status && p.status.toLowerCase().includes(lower))
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [people, search, sortField, sortDir]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton field="person">Name</SortButton></TableHead>
              <TableHead><SortButton field="role">Role</SortButton></TableHead>
              <TableHead><SortButton field="sow">SOW</SortButton></TableHead>
              <TableHead><SortButton field="rate">Rate ($/hr)</SortButton></TableHead>
              <TableHead>Kerb</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead><SortButton field="business_unit">Business Unit</SortButton></TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {search ? "No matching people found" : "No people yet. Upload a People Rates spreadsheet to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((person) => {
                const isInactive = (person.status || "Active") === "Not Active";
                return (
                <TableRow key={person.id} className={isInactive ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {person.photo ? (
                        <img
                          src={`/api/photos/${person.photo}`}
                          alt={person.person}
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <CountryFlag country={person.country} countryCodeMap={countryCodeMap} />
                      {person.person}
                    </div>
                  </TableCell>
                  <TableCell>{person.role || "—"}</TableCell>
                  <TableCell>
                    {person.sow ? <Badge variant="outline">{person.sow}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    {person.rate
                      ? `$${person.rate.toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{person.kerb || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {person.managed_services ? <Badge variant="secondary" className="text-xs">MS</Badge> : null}
                      {person.architecture ? <Badge variant="secondary" className="text-xs">Arch</Badge> : null}
                      {person.app_support ? <Badge variant="secondary" className="text-xs">App</Badge> : null}
                      {person.computing ? <Badge variant="secondary" className="text-xs">Comp</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {person.business_unit ? <Badge>{person.business_unit}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    {isInactive ? (
                      <Badge variant="destructive" className="text-xs">Not Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(person)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => person.id && onDelete(person.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {people.length} people
      </p>
    </div>
  );
}
