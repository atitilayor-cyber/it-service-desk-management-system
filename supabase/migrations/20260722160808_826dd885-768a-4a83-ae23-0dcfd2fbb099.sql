CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'ITSDMS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.tickets
SET ticket_number = 'ITSDMS-' || substring(ticket_number from 5)
WHERE ticket_number LIKE 'TKT-%';