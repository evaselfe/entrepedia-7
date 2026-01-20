-- Fix function search path for cleanup_expired_otps
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_reset_otps 
  WHERE expires_at < now() OR is_used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;