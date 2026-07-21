
-- Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke public execute on internal trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role and get_my_role: keep executable by authenticated (needed for RLS + client convenience), revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Tighten ticket_history insert: only allow inserts referencing a ticket the user can touch
DROP POLICY IF EXISTS "ticket_history_insert" ON public.ticket_history;
CREATE POLICY "ticket_history_insert" ON public.ticket_history
  FOR INSERT TO authenticated WITH CHECK (
    changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_history.ticket_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'technician'))
    )
  );
