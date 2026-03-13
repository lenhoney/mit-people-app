"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type MenuPermissions = Record<
  string,
  { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
>;

interface PermissionsContextValue {
  permissions: MenuPermissions;
  loading: boolean;
  canCreate: (menuItem: string) => boolean;
  canRead: (menuItem: string) => boolean;
  canUpdate: (menuItem: string) => boolean;
  canDelete: (menuItem: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: {},
  loading: true,
  canCreate: () => false,
  canRead: () => false,
  canUpdate: () => false,
  canDelete: () => false,
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<MenuPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/permissions")
      .then((res) => {
        if (!res.ok) return {};
        return res.json();
      })
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setPermissions(data as MenuPermissions);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const canCreate = useCallback(
    (menuItem: string) => !!permissions[menuItem]?.can_create,
    [permissions]
  );
  const canRead = useCallback(
    (menuItem: string) => !!permissions[menuItem]?.can_read,
    [permissions]
  );
  const canUpdate = useCallback(
    (menuItem: string) => !!permissions[menuItem]?.can_update,
    [permissions]
  );
  const canDelete = useCallback(
    (menuItem: string) => !!permissions[menuItem]?.can_delete,
    [permissions]
  );

  return (
    <PermissionsContext.Provider
      value={{ permissions, loading, canCreate, canRead, canUpdate, canDelete }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
