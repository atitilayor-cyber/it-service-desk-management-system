-- Restrict profiles SELECT: self, admin, technician
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_select_admin ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY profiles_select_technician ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'technician'::app_role));

-- Revoke EXECUTE on SECURITY DEFINER helpers from signed-in users.
-- These are used only inside RLS policy expressions, where Postgres
-- evaluates them without an EXECUTE permission check on the caller.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon, authenticated;