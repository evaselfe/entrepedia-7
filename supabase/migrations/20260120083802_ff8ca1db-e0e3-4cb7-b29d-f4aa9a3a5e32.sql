-- Re-enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy that allows all operations (will be bypassed by service role)
-- But blocks direct access from anon/authenticated roles
CREATE POLICY "No direct access to sessions"
ON user_sessions
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);