import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTicket,
  getMe,
  assignTicket,
  listTechnicians,
  updateTicketStatus,
  addTicketNote,
} from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_COLORS, PRIORITY_COLORS, TICKET_STATUSES, type TicketStatus } from "@/lib/roles";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const getTicketFn = useServerFn(getTicket);
  const meFn = useServerFn(getMe);
  const listTechFn = useServerFn(listTechnicians);
  const assignFn = useServerFn(assignTicket);
  const updateFn = useServerFn(updateTicketStatus);
  const addNoteFn = useServerFn(addTicketNote);

  const { data, isLoading } = useQuery({ queryKey: ["ticket", id], queryFn: () => getTicketFn({ data: { id } }) });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: techs } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => listTechFn(),
    enabled: me?.role === "admin",
  });

  const [selectedTech, setSelectedTech] = useState<string>("");
  const [newStatus, setNewStatus] = useState<TicketStatus>("In Progress");
  const [resolution, setResolution] = useState("");
  const [workNote, setWorkNote] = useState("");

  const assignMut = useMutation({
    mutationFn: (tid: string) => assignFn({ data: { ticketId: id, technicianId: tid } }),
    onSuccess: () => {
      toast.success("Ticket assigned — technician notified");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateFn({ data: { ticketId: id, status: newStatus, resolution: resolution || undefined } }),
    onSuccess: () => {
      toast.success(newStatus === "Resolved" ? "Ticket marked as Resolved — requester notified" : `Status updated to ${newStatus}`);
      setResolution("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const noteMut = useMutation({
    mutationFn: () => addNoteFn({ data: { ticketId: id, note: workNote } }),
    onSuccess: () => {
      toast.success("Work note added");
      setWorkNote("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading ticket…</div>;

  const t = data.ticket;
  const history = data.history;
  const role = me?.role;
  const isTechForTicket = role === "technician" && t.assigned_to === me?.userId;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/tickets"><ArrowLeft className="mr-2 h-4 w-4" /> Back to tickets</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                <Badge variant="outline" className={STATUS_COLORS[t.status]}>{t.status}</Badge>
                <Badge variant="outline" className={PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS]}>{t.priority}</Badge>
                <Badge variant="secondary">{t.category}</Badge>
              </div>
              <CardTitle className="text-xl mt-2">{t.title}</CardTitle>
              <div className="text-xs text-muted-foreground">
                Submitted by {t.creator_name ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.description}</p>
              {t.resolution && (
                <div className="mt-4 rounded-md border-l-4 border-emerald-500 bg-emerald-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Resolution</div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{t.resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {history.map((h, idx) => (
                  <li key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`grid h-6 w-6 place-items-center rounded-full ${idx === history.length - 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {idx === history.length - 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
                      </div>
                      {idx < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="text-sm">
                        {h.from_status ? <><span className="text-muted-foreground">{h.from_status}</span> → </> : null}
                        <Badge variant="outline" className={STATUS_COLORS[h.to_status as TicketStatus]}>{h.to_status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(h.created_at), "PPp")}
                      </div>
                      {h.note && <div className="text-sm mt-1 text-muted-foreground">{h.note}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Assigned to" value={t.assignee_name ?? "— unassigned —"} />
              <Detail label="Created" value={format(new Date(t.created_at), "PPp")} />
              <Detail label="Updated" value={format(new Date(t.updated_at), "PPp")} />
              {t.resolved_at && <Detail label="Resolved" value={format(new Date(t.resolved_at), "PPp")} />}
            </CardContent>
          </Card>

          {role === "admin" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Assign technician</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedTech} onValueChange={setSelectedTech}>
                  <SelectTrigger><SelectValue placeholder="Select technician…" /></SelectTrigger>
                  <SelectContent>
                    {(techs ?? []).map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>{tech.full_name || tech.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" disabled={!selectedTech || assignMut.isPending} onClick={() => assignMut.mutate(selectedTech)}>
                  Assign ticket
                </Button>
              </CardContent>
            </Card>
          )}

          {(isTechForTicket || role === "admin") && (
            <Card>
              <CardHeader><CardTitle className="text-base">Update status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TicketStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(newStatus === "Resolved" || newStatus === "Closed") && (
                  <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} placeholder="Resolution notes (optional but recommended)" />
                )}
                <Button className="w-full" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                  Update status
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}
