import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTickets } from "@/lib/tickets.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS, PRIORITY_COLORS, TICKET_STATUSES } from "@/lib/roles";
import { PlusCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/tickets/")({
  component: TicketsPage,
});

function TicketsPage() {
  const fn = useServerFn(listTickets);
  const { data, isLoading } = useQuery({ queryKey: ["tickets"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = data?.tickets ?? [];
    return list.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (q && !`${t.title} ${t.ticket_number} ${t.description}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [data, q, status]);

  const role = data?.role;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">
            {role === "admin" ? "All tickets" : role === "technician" ? "Assigned to me" : "My tickets"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {data?.tickets.length ?? 0} tickets
          </p>
        </div>
        {(role === "end_user" || role === "admin") && (
          <Button asChild>
            <Link to="/tickets/new"><PlusCircle className="mr-2 h-4 w-4" /> New Ticket</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number, or description" className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No tickets match your filters.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => (
                <Link
                  key={t.id}
                  to="/tickets/$id"
                  params={{ id: t.id }}
                  className="grid gap-2 px-4 py-3 hover:bg-muted/50 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                      <Badge variant="outline" className={STATUS_COLORS[t.status]}>{t.status}</Badge>
                      <Badge variant="outline" className={PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS]}>{t.priority}</Badge>
                      <span className="text-xs text-muted-foreground">· {t.category}</span>
                    </div>
                    <div className="mt-1 font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      By {t.creator_name ?? "—"}
                      {t.assignee_name && <> · assigned to {t.assignee_name}</>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 sm:text-right">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
