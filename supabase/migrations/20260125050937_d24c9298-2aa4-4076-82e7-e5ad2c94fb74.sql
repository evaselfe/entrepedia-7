-- Add education and experience columns to job_applications table
ALTER TABLE public.job_applications
ADD COLUMN education_qualification text,
ADD COLUMN experience_details text;