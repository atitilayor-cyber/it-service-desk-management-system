
# IT Service Desk Management System — Plan

A professional, role-based ticketing system built on Lovable Cloud with real authentication, persistent data, and a modern dashboard UI suitable for academic presentation.

## Roles & Capabilities

- **End User** — submit tickets, track status/history of own tickets
- **IT Support Technician** — view assigned tickets, update status (Assigned → In Progress → Resolved), add resolution notes
- **Administrator** — view all tickets, assign to technicians, manage users, view reports and analytics

## Pages / Routes

- `/auth` — polished professional login/signup page (split-screen: brand panel + form, subtle gradient, glass card, feature highlights). Includes "Demo accounts" quick-fill buttons for presentation.
- `/` — public landing → redirects signed-in users to their dashboard by role
- `/dashboard` — role-aware dashboard (stats cards + charts)
- `/tickets` — list (scoped by role: own / assigned / all)
- `/tickets/new` — End User ticket submission form
- `/tickets/$id` — ticket detail, status timeline, assign/update actions (role-gated)
- `/users` — Admin only: user management (view users, change roles)
- `/reports` — Admin only: charts & exportable summary
- All app routes live under `_authenticated/`

## Ticket Model

- Auto-generated ticket number: `TKT-YYYYMMDD-NNNN`
- Fields: title, category (Hardware, Software, Network, Account, Other), priority (Low, Medium, High, Critical), description, status (Open, Assigned, In Progress, Resolved, Closed), created_by, assigned_to, resolution notes, timestamps
- Status history table for tracking timeline

## Database (Lovable Cloud)

- `profiles` (id → auth.users, full_name, department)
- `user_roles` (user_id, role: enum end_user | technician | admin) — separate table per security rules, with `has_role()` SECURITY DEFINER function
- `tickets` (ticket_number, title, category, priority, status, description, created_by, assigned_to, resolution, timestamps)
- `ticket_history` (ticket_id, from_status, to_status, changed_by, note, timestamp)
- RLS: end users see own tickets; technicians see assigned; admins see all. Grants + policies set per row-level-security rules.
- Trigger auto-creates profile + default `end_user` role on signup.
- Seed migration inserts 3 demo accounts and ~15 sample tickets across statuses so charts and lists look populated immediately.

## Demo Accounts (seeded)

- `admin@demo.com` / `Demo1234!` — Administrator
- `tech@demo.com` / `Demo1234!` — Technician (with assigned tickets)
- `user@demo.com` / `Demo1234!` — End User (with submitted tickets)

Login page shows one-click "Fill as Admin/Technician/End User" buttons.

## Dashboards

- **End User**: My open tickets, resolved count, recent activity, status donut
- **Technician**: Assigned / In Progress / Resolved counts, priority breakdown bar chart, my ticket queue
- **Admin**: Total tickets, open vs resolved, by-category bar, by-priority pie, tickets-over-time line, technician workload, recent tickets table

Charts via `recharts`. Stats cards with icons via `lucide-react`.

## Design

- Modern professional palette: deep indigo/slate primary, teal accent, clean neutrals; light + dark mode via existing tokens (refined).
- Sidebar layout using shadcn `Sidebar` with role-filtered nav.
- Responsive: mobile sidebar collapses; grid/flex responsive rules applied.
- Login page redesigned: split-screen with animated gradient brand panel (logo, tagline, 3 feature bullets), right side form card, demo-account chips.

## Tech Details

- Enable Lovable Cloud (Supabase auth + DB).
- Server functions (`createServerFn` + `requireSupabaseAuth`) for all ticket reads/writes; `_authenticated/` layout is integration-managed.
- TanStack Query for data fetching (loader + `useSuspenseQuery` pattern).
- Zod validation on ticket form.
- Ticket number generated server-side in a SQL function/trigger.
- Sample seed data inserted in the same migration as schema.

## Build Order

1. Enable Lovable Cloud
2. Migration: enum, tables, RLS, grants, triggers, seed data + demo users
3. Supabase server fns for tickets/users/stats
4. `_authenticated/` layout, sidebar shell, role context
5. Professional `/auth` page with demo login chips
6. Dashboards (role-specific with charts)
7. Ticket list + detail + new ticket form
8. Admin user management + reports
9. Root head metadata, landing redirect, polish pass
