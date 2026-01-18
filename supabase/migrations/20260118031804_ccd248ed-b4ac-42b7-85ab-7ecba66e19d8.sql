-- Create community_discussions table
CREATE TABLE public.community_discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.community_discussions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Community members can view discussions"
ON public.community_discussions
FOR SELECT
USING (public.is_community_member(community_id));

CREATE POLICY "Community members can create discussions"
ON public.community_discussions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.is_community_member(community_id)
);

CREATE POLICY "Users can update their own discussions"
ON public.community_discussions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discussions"
ON public.community_discussions
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_community_discussions_updated_at
BEFORE UPDATE ON public.community_discussions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_community_discussions_community_id ON public.community_discussions(community_id);
CREATE INDEX idx_community_discussions_user_id ON public.community_discussions(user_id);
CREATE INDEX idx_community_discussions_created_at ON public.community_discussions(created_at DESC);