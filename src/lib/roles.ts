export type AppRole = "end_user" | "technician" | "admin";

export const ROLE_LABEL: Record<AppRole, string> = {
  end_user: "End User",
  technician: "IT Technician",
  admin: "Administrator",
};

export const TICKET_CATEGORIES = ["Hardware", "Software", "Network", "Account", "Other"] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const TICKET_STATUSES = ["Open", "Assigned", "In Progress", "Resolved", "Closed"] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_COLORS: Record<TicketStatus, string> = {
  Open: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  Assigned: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "In Progress": "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  Resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  Closed: "bg-muted text-muted-foreground border-border",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  Low: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  Medium: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  High: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  Critical: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};
