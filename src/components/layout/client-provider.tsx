"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

interface Client {
  id: number;
  name: string;
  short_name: string;
  logo: string | null;
}

interface ClientContextType {
  clients: Client[];
  selectedClientId: number | null;
  selectedClient: Client | null;
  setSelectedClientId: (id: number) => void;
  refreshClients: () => void;
  loading: boolean;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientIdState] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) {
        setClients([]);
        return [] as Client[];
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setClients(arr);
      return arr as Client[];
    } catch {
      setClients([]);
      return [] as Client[];
    }
  }, []);

  // Load clients on mount and restore selection
  useEffect(() => {
    loadClients().then((data) => {
      const stored = localStorage.getItem("selectedClientId");
      if (stored && data.some((c: Client) => c.id === Number(stored))) {
        setSelectedClientIdState(Number(stored));
      } else {
        // Default to MIT
        const mit = data.find((c: Client) => c.short_name === "MIT");
        if (mit) {
          setSelectedClientIdState(mit.id);
          localStorage.setItem("selectedClientId", String(mit.id));
        } else if (data.length > 0) {
          setSelectedClientIdState(data[0].id);
          localStorage.setItem("selectedClientId", String(data[0].id));
        }
      }
      setLoading(false);
    });
  }, [loadClients]);

  const setSelectedClientId = useCallback((id: number) => {
    setSelectedClientIdState(id);
    localStorage.setItem("selectedClientId", String(id));
  }, []);

  const refreshClients = useCallback(() => {
    loadClients();
  }, [loadClients]);

  const selectedClient =
    clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClientId,
        selectedClient,
        setSelectedClientId,
        refreshClients,
        loading,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClient must be used within ClientProvider");
  }
  return context;
}
