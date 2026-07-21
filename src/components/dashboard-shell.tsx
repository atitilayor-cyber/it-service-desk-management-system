import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Ticket,
  Users,
  BarChart3,
  LogOut,
  PlusCircle,
  Headphones,
  Menu,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMe, listTickets } from "@/lib/tickets.functions";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["end_user", "technician", "admin"] },
  { to: "/tickets", label: "Tickets", icon: Ticket, roles: ["end_user", "technician", "admin"] },
  { to: "/tickets/new", label: "New Ticket", icon: PlusCircle, roles: ["end_user", "admin"] },
  { to: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [mobileOpen, setMobileOpen] = useState(false);

  const role: AppRole = (me?.role as AppRole) ?? "end_user";
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <SidebarInner items={items} role={role} name={me?.profile?.full_name ?? "User"} />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
                <SidebarInner
                  items={items}
                  role={role}
                  name={me?.profile?.full_name ?? "User"}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <PageTitle />
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell role={role} userId={me?.userId ?? ""} />
            <UserMenu name={me?.profile?.full_name ?? "User"} email={me?.profile?.email ?? ""} role={role} />
          </div>
        </header>
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  items,
  role,
  name,
  onNavigate,
}: {
  items: NavItem[];
  role: AppRole;
  name: string;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-sidebar-border/50 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Headphones className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight truncate">HelpDesk Pro</div>
          <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
            Service Desk
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/50 p-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{name}</div>
            <div className="text-[11px] text-sidebar-foreground/60 truncate">{ROLE_LABEL[role]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/tickets": "Tickets",
    "/tickets/new": "Submit Ticket",
    "/users": "User Management",
    "/reports": "Reports & Analytics",
  };
  const title =
    map[pathname] ??
    (pathname.startsWith("/tickets/") ? "Ticket Details" : "HelpDesk Pro");
  return <h1 className="text-base font-semibold tracking-tight">{title}</h1>;
}

function UserMenu({ name, email, role }: { name: string; email: string; role: AppRole }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  useEffect(() => {}, []);

  async function signOut() {
    setBusy(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-sm font-medium truncate max-w-[180px]">{name}</span>
        <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
          {ROLE_LABEL[role]} · {email}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
