import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTickets } from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Ticket as TicketIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import { STATUS_COLORS, PRIORITY_COLORS, type TicketStatus } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const STATUS_ORDER: TicketStatus[] = ["Open", "Assigned", "In Progress", "Resolved", "Closed"];
const STATUS_CHART_COLORS: Record<TicketStatus, string> = {
  Open: "#3b82f6",
  Assigned: "#f59e0b",
  "In Progress": "#a855f7",
  Resolved: "#10b981",
  Closed: "#6b7280",
};

function Dashboard() {
  const fn = useServerFn(listTickets);
  const { data, isLoading } = useQuery({ queryKey: ["tickets"], queryFn: () => fn() });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;

  const tickets = data.tickets;
  const role = data.role;

  const total = tickets.length;
  const open = tickets.filter((t) => t.status === "Open" || t.status === "Assigned").length;
  const inProgress = tickets.filter((t) => t.status === "In Progress").length;
  const resolved = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;

  const byStatus = STATUS_ORDER.map((s) => ({
    name: s,
    value: tickets.filter((t) => t.status === s).length,
  })).filter((d) => d.value > 0);

  const byCategory = ["Hardware", "Software", "Network", "Account", "Other"].map((c) => ({
    name: c,
    tickets: tickets.filter((t) => t.category === c).length,
  }));

  const byPriority = ["Low", "Medium", "High", "Critical"].map((p) => ({
    name: p,
    count: tickets.filter((t) => t.priority === p).length,
  }));

  // Trend over last 7 days
  const now = new Date();
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      created: tickets.filter((t) => t.created_at.slice(0, 10) === key).length,
      resolved: tickets.filter((t) => t.resolved_at?.slice(0, 10) === key).length,
    };
  });

  const roleTitle =
    role === "admin"
      ? "Administrator overview"
      : role === "technician"
        ? "My assigned queue"
        : "My support tickets";

  const roleSubtitle =
    role === "admin"
      ? "System-wide ticket activity across all users and technicians."
      : role === "technician"
        ? "Tickets currently assigned to you."
        : "Track the status of tickets you've submitted.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">{roleTitle}</h2>
          <p className="text-sm text-muted-foreground">{roleSubtitle}</p>
        </div>
        {(role === "end_user" || role === "admin") && (
          <Button asChild>
            <Link to="/tickets/new">
              <PlusCircle className="mr-2 h-4 w-4" /> New Ticket
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<TicketIcon className="h-4 w-4" />} label="Total Tickets" value={total} accent="from-indigo-500 to-violet-500" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Open" value={open} accent="from-blue-500 to-sky-500" />
        <StatCard icon={<Clock className="h-4 w-4" />} label="In Progress" value={inProgress} accent="from-purple-500 to-fuchsia-500" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved" value={resolved} accent="from-emerald-500 to-teal-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tickets — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#6366f1" strokeWidth={2} name="Created" />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {byStatus.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {byStatus.map((s) => (
                      <Cell key={s.name} fill={STATUS_CHART_COLORS[s.name as TicketStatus]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tickets" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By priority</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent tickets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {tickets.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                to="/tickets/$id"
                params={{ id: t.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                    <Badge variant="outline" className={STATUS_COLORS[t.status]}>{t.status}</Badge>
                    <Badge variant="outline" className={PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS]}>{t.priority}</Badge>
                  </div>
                  <div className="mt-1 font-medium truncate">{t.title}</div>
                </div>
                <div className="hidden sm:block text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                </div>
              </Link>
            ))}
            {tickets.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No tickets yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground truncate">{label}</div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="grid h-full place-items-center text-xs text-muted-foreground">No data yet</div>;
}
