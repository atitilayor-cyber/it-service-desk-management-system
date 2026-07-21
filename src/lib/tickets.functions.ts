import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AppRole, TicketStatus } from "./roles";

// --- Types returned to client
export type TicketRow = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: TicketStatus;
  created_by: string;
  assigned_to: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  creator_name?: string | null;
  assignee_name?: string | null;
};

async function getRole(supabase: any, userId: string): Promise<AppRole> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles: AppRole[] = (data ?? []).map((r: any) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("technician")) return "technician";
  return "end_user";
}

async function attachNames(supabase: any, tickets: any[]): Promise<TicketRow[]> {
  const ids = new Set<string>();
  for (const t of tickets) {
    if (t.created_by) ids.add(t.created_by);
    if (t.assigned_to) ids.add(t.assigned_to);
  }
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", Array.from(ids));
  const map = new Map<string, { name: string; email: string }>();
  for (const p of profs ?? []) map.set(p.id, { name: p.full_name || p.email, email: p.email });
  return tickets.map((t) => ({
    ...t,
    creator_name: t.created_by ? map.get(t.created_by)?.name ?? null : null,
    assignee_name: t.assigned_to ? map.get(t.assigned_to)?.name ?? null : null,
  }));
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const role = await getRole(supabase, userId);
    return { userId, role, profile };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const role = await getRole(supabase, userId);
    let q = supabase.from("tickets").select("*").order("created_at", { ascending: false });
    if (role === "end_user") q = q.eq("created_by", userId);
    else if (role === "technician") q = q.eq("assigned_to", userId);
    const { data, error } = await q;
    if (error) throw error;
    return { role, tickets: await attachNames(supabase, data ?? []) };
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: ticket, error } = await supabase.from("tickets").select("*").eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!ticket) throw new Error("Ticket not found");
    const [withNames] = await attachNames(supabase, [ticket]);
    const { data: history } = await supabase
      .from("ticket_history")
      .select("*")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });
    return { ticket: withNames, history: history ?? [] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().min(10).max(2000),
        category: z.enum(["Hardware", "Software", "Network", "Account", "Other"]),
        priority: z.enum(["Low", "Medium", "High", "Critical"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("tickets")
      .insert({ ...data, created_by: userId, status: "Open" } as never)
      .select("*")
      .single();
    if (error) throw error;
    return inserted;
  });

export const assignTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticketId: z.string().uuid(), technicianId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const role = await getRole(supabase, userId);
    if (role !== "admin") throw new Error("Forbidden");
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to: data.technicianId, status: "Assigned" })
      .eq("id", data.ticketId);
    if (error) throw error;
    return { ok: true };
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["Open", "Assigned", "In Progress", "Resolved", "Closed"]),
        resolution: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.resolution) patch.resolution = data.resolution;
    const { error } = await supabase.from("tickets").update(patch as never).eq("id", data.ticketId);
    if (error) throw error;
    return { ok: true };
  });

export const addTicketNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticketId: z.string().uuid(), note: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: t, error: tErr } = await supabase
      .from("tickets")
      .select("status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!t) throw new Error("Ticket not found");
    const { error } = await supabase.from("ticket_history").insert({
      ticket_id: data.ticketId,
      from_status: t.status,
      to_status: t.status,
      changed_by: userId,
      note: data.note,
    } as never);
    if (error) throw error;
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const role = await getRole(supabase, userId);
    if (role !== "admin") throw new Error("Forbidden");
    const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => {
      const rs = rolesByUser.get(p.id) ?? [];
      const primary: AppRole = rs.includes("admin") ? "admin" : rs.includes("technician") ? "technician" : "end_user";
      return { ...p, role: primary };
    });
  });

export const listTechnicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const role = await getRole(supabase, userId);
    if (role !== "admin") throw new Error("Forbidden");
    const { data: techRoles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
    const ids = (techRoles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email, department").in("id", ids);
    return profs ?? [];
  });

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        role: z.enum(["end_user", "technician", "admin"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const role = await getRole(supabase, userId);
    if (role !== "admin") throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.targetUserId, role: data.role });
    return { ok: true };
  });
