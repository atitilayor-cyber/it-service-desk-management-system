
-- Enums
CREATE TYPE public.app_role AS ENUM ('end_user', 'technician', 'admin');
CREATE TYPE public.ticket_status AS ENUM ('Open', 'Assigned', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE public.ticket_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE public.ticket_category AS ENUM ('Hardware', 'Software', 'Network', 'Account', 'Other');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- get_my_role helper
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'technician' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'Other',
  priority public.ticket_priority NOT NULL DEFAULT 'Medium',
  status public.ticket_status NOT NULL DEFAULT 'Open',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Ticket History
CREATE TABLE public.ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status public.ticket_status,
  to_status public.ticket_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

-- Sequence for ticket numbers
CREATE SEQUENCE public.ticket_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tickets_updated
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Status history trigger
CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history (ticket_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by, 'Ticket created');
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.ticket_history (ticket_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.resolution);
    IF NEW.status = 'Resolved' AND OLD.status <> 'Resolved' THEN
      NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_history_insert
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();

CREATE TRIGGER trg_ticket_history_update
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();

-- Auto-create profile + default end_user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'department', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'end_user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- profiles: everyone signed-in can read basic profile (for names on tickets); users update own; admins update any
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: user can see own roles, admin can see all
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- tickets
CREATE POLICY "tickets_select_own_or_assigned_or_admin" ON public.tickets
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'technician')
  );

CREATE POLICY "tickets_insert_own" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "tickets_update_admin_or_technician_or_owner" ON public.tickets
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'technician') AND assigned_to = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "tickets_delete_admin" ON public.tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ticket_history
CREATE POLICY "ticket_history_select" ON public.ticket_history
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_history.ticket_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'technician'))
    )
  );

CREATE POLICY "ticket_history_insert" ON public.ticket_history
  FOR INSERT TO authenticated WITH CHECK (true);
