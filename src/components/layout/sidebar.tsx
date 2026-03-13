"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  FolderKanban,
  Clock,
  FileBarChart,
  GanttChart,
  CalendarCheck2,
  Palmtree,
  ScrollText,
  LogOut,
} from "lucide-react";
import { useClient } from "./client-provider";
import { ClientSelector } from "./client-selector";

interface SidebarUser {
  id: number;
  name: string;
  email: string;
}

interface SidebarProps {
  user: SidebarUser | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/business-units", label: "Business Units", icon: Building2 },
  { href: "/clients", label: "Clients", icon: Handshake },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/timesheets", label: "Timesheets", icon: Clock },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/gantt", label: "Gantt Chart", icon: GanttChart },
  { href: "/planned-work", label: "Planned Work", icon: CalendarCheck2 },
  { href: "/time-off", label: "Time Off", icon: Palmtree },
  { href: "/audit-trail", label: "Audit Trail", icon: ScrollText },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { selectedClient } = useClient();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 glass">
      <div className="flex flex-col items-center justify-center border-b border-white/8 px-5 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/populus-logo.png" alt="Populus" className="h-12" />
          {selectedClient?.logo && (
            <img
              src={`/api/client-logos/${selectedClient.logo}`}
              alt={selectedClient.short_name}
              className="h-10 rounded object-contain"
            />
          )}
        </Link>
        <div className="w-full mt-2">
          <ClientSelector />
        </div>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white border border-white/10"
                  : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/8 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.name}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user.email}
              </p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </a>
        </div>
      )}
    </aside>
  );
}
