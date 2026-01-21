-- Create function to automatically hide posts with 10+ reports
CREATE OR REPLACE FUNCTION public.auto_hide_post_on_reports()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Only process post reports
  IF NEW.reported_type = 'post' THEN
    -- Count total reports for this post
    SELECT COUNT(*) INTO report_count
    FROM public.reports
    WHERE reported_id = NEW.reported_id
    AND reported_type = 'post';

    -- Auto-hide if 10 or more reports
    IF report_count >= 10 THEN
      UPDATE public.posts
      SET is_hidden = true,
          hidden_at = now(),
          hidden_reason = 'Auto-hidden due to 10+ user reports'
      WHERE id = NEW.reported_id
      AND (is_hidden = false OR is_hidden IS NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-hide posts on report creation
DROP TRIGGER IF EXISTS auto_hide_post_trigger ON public.reports;
CREATE TRIGGER auto_hide_post_trigger
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.auto_hide_post_on_reports();

-- Create function to cleanup old messages (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete messages older than 7 days
  WITH deleted AS (
    DELETE FROM public.messages
    WHERE created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Clean up conversations with no messages
  DELETE FROM public.conversations c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add report_count column to posts for easy tracking (denormalized for performance)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'report_count'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN report_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Update report_count on posts when reports are added
CREATE OR REPLACE FUNCTION public.update_post_report_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reported_type = 'post' THEN
    UPDATE public.posts
    SET report_count = (
      SELECT COUNT(*) FROM public.reports 
      WHERE reported_id = NEW.reported_id AND reported_type = 'post'
    )
    WHERE id = NEW.reported_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_post_report_count_trigger ON public.reports;
CREATE TRIGGER update_post_report_count_trigger
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_post_report_count();