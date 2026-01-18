-- Create table for blocked words
CREATE TABLE public.blocked_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;

-- Only admins can view blocked words
CREATE POLICY "Admins can view blocked words"
ON public.blocked_words
FOR SELECT
TO authenticated
USING (public.has_any_admin_role(auth.uid()));

-- Only admins can insert blocked words
CREATE POLICY "Admins can insert blocked words"
ON public.blocked_words
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_admin_role(auth.uid()));

-- Only admins can update blocked words
CREATE POLICY "Admins can update blocked words"
ON public.blocked_words
FOR UPDATE
TO authenticated
USING (public.has_any_admin_role(auth.uid()));

-- Only admins can delete blocked words
CREATE POLICY "Admins can delete blocked words"
ON public.blocked_words
FOR DELETE
TO authenticated
USING (public.has_any_admin_role(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_blocked_words_updated_at
BEFORE UPDATE ON public.blocked_words
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if content contains blocked words
CREATE OR REPLACE FUNCTION public.contains_blocked_words(content TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_words 
    WHERE is_active = true 
    AND content ILIKE '%' || word || '%'
  );
END;
$$;