DROP POLICY IF EXISTS profiles_select_technician ON public.profiles;

CREATE POLICY profiles_select_technician ON public.profiles
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'technician'::app_role)
  AND (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.assigned_to = auth.uid()
        AND (t.created_by = profiles.id OR t.assigned_to = profiles.id)
    )
  )
);