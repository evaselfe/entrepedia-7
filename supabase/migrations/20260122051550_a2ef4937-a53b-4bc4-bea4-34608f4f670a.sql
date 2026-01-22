-- Job status enum
CREATE TYPE public.job_status AS ENUM ('open', 'closed');

-- Jobs table
CREATE TABLE public.jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  conditions text,
  location text,
  status public.job_status DEFAULT 'open',
  max_applications integer,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job Applications table
CREATE TABLE public.job_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  applicant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, applicant_id)
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Jobs policies: Anyone can view open jobs, creators can see their own closed jobs
CREATE POLICY "Anyone can view open jobs" ON public.jobs
  FOR SELECT USING (status = 'open' OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their jobs" ON public.jobs
  FOR DELETE USING (auth.uid() = creator_id);

-- Applications policies: Only job creator can see applications
CREATE POLICY "Creators can view applications" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = job_applications.job_id 
      AND jobs.creator_id = auth.uid()
    )
    OR applicant_id = auth.uid()
  );

CREATE POLICY "Users can apply to open jobs" ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() = applicant_id AND
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = job_id AND jobs.status = 'open'
    )
  );

CREATE POLICY "Users can withdraw applications" ON public.job_applications
  FOR DELETE USING (auth.uid() = applicant_id);

-- Trigger to auto-close job when max applications reached
CREATE OR REPLACE FUNCTION public.check_job_application_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = NEW.job_id
    AND j.max_applications IS NOT NULL
    AND j.status = 'open'
    AND (SELECT count(*) FROM public.job_applications WHERE job_id = NEW.job_id) >= j.max_applications
  ) THEN
    UPDATE public.jobs SET status = 'closed', updated_at = now() WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER after_job_application_insert
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.check_job_application_limit();

-- Add updated_at trigger
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();