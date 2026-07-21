import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTickets, listTechnicians } from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function Reports() {
  const ticketsFn = useServerFn(listTickets);
  const techFn = useServerFn(listTechnicians);
  const { data } = useQuery({ queryKey: ["tickets"], queryFn: () => ticketsFn() });
  const { data: techs } = useQuery({ queryKey: ["technicians"], queryFn: () => techFn() });

  const tickets = data?.tickets ?? [];

  const byCategory = ["Hardware", "Software", "Network", "Account", "Other"].map((c) => ({
    name: c,
    value: tickets.filter((t) => t.category === c).length,
  }));

  const byPriority = ["Low", "Medium", "High", "Critical"].map((p) => ({
    name: p,
    value: tickets.filter((t) => t.priority === p).length,
  }));

  const workload = (techs ?? []).map((tech) => ({
    name: tech.full_name || tech.email,
    open: tickets.filter((t) => t.assigned_to === tech.id && t.status !== "Resolved" && t.status !== "Closed").length,
    resolved: tickets.filter((t) => t.assigned_to === tech.id && (t.status === "Resolved" || t.status === "Closed")).length,
  }));

  function exportCsv() {
    const header = ["Ticket #", "Title", "Category", "Priority", "Status", "Created By", "Assigned To", "Created", "Resolved"];
    const rows = tickets.map((t) => [
      t.ticket_number,
      t.title.replaceAll(",", " "),
      t.category,
      t.priority,
      t.status,
      t.creator_name ?? "",
      t.assignee_name ?? "",
      t.created_at,
      t.resolved_at ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helpdesk-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const resolvedCount = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
  const avgResolution =
    tickets
      .filter((t) => t.resolved_at)
      .reduce((acc, t) => acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) /
    (resolvedCount || 1);
  const avgHours = Math.round(avgResolution / (1000 * 60 * 60));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">Ticket performance and technician workload.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total tickets" value={tickets.length} />
        <MetricCard label="Resolved" value={resolvedCount} />
        <MetricCard label="Resolution rate" value={`${tickets.length ? Math.round((resolvedCount / tickets.length) * 100) : 0}%`} />
        <MetricCard label="Avg resolution time" value={`${avgHours}h`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tickets by category</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tickets by priority</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Technician workload</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workload}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="open" stackId="a" fill="#f59e0b" name="Open" />
              <Bar dataKey="resolved" stackId="a" fill="#10b981" name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
