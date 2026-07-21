CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'technician' THEN 2 ELSE 3 END
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_my_role() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_my_role() TO authenticated, service_role;

-- profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_technician ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY profiles_select_technician ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'technician'::public.app_role));
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- tickets
DROP POLICY IF EXISTS tickets_select_own_or_assigned_or_admin ON public.tickets;
DROP POLICY IF EXISTS tickets_update_admin_or_technician_or_owner ON public.tickets;
DROP POLICY IF EXISTS tickets_delete_admin ON public.tickets;

CREATE POLICY tickets_select_own_or_assigned_or_admin ON public.tickets
  FOR SELECT TO authenticated
  USING ((created_by = auth.uid()) OR (assigned_to = auth.uid())
         OR private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.has_role(auth.uid(), 'technician'::public.app_role));

CREATE POLICY tickets_update_admin_or_technician_or_owner ON public.tickets
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR (private.has_role(auth.uid(), 'technician'::public.app_role) AND assigned_to = auth.uid())
         OR created_by = auth.uid());

CREATE POLICY tickets_delete_admin ON public.tickets
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ticket_history
DROP POLICY IF EXISTS ticket_history_select ON public.ticket_history;
DROP POLICY IF EXISTS ticket_history_insert ON public.ticket_history;

CREATE POLICY ticket_history_select ON public.ticket_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_history.ticket_id
      AND ((t.created_by = auth.uid()) OR (t.assigned_to = auth.uid())
           OR private.has_role(auth.uid(), 'admin'::public.app_role)
           OR private.has_role(auth.uid(), 'technician'::public.app_role))
  ));

CREATE POLICY ticket_history_insert ON public.ticket_history
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_history.ticket_id
      AND ((t.created_by = auth.uid()) OR (t.assigned_to = auth.uid())
           OR private.has_role(auth.uid(), 'admin'::public.app_role)
           OR private.has_role(auth.uid(), 'technician'::public.app_role))
  ));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.get_my_role();