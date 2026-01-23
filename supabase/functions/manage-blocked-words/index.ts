import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, session_token, ...params } = await req.json();
    console.log("manage-blocked-words action:", action);

    // Validate admin session
    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session and get user
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at")
      .eq("session_token", session_token)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("Session validation failed:", sessionError);
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);

    const adminRoles = ["super_admin", "content_moderator"];
    const hasAdminRole = roles?.some(r => adminRoles.includes(r.role));

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle actions
    if (action === "list") {
      const { data, error } = await supabase
        .from("blocked_words")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add") {
      const { words } = params;
      if (!words || !Array.isArray(words) || words.length === 0) {
        return new Response(
          JSON.stringify({ error: "Words array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase.from("blocked_words").insert(
        words.map((word: string) => ({
          word: word.toLowerCase().trim(),
          created_by: session.user_id,
        }))
      );

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "One or more words already exist" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { id, word, is_active } = params;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Word ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, unknown> = {};
      if (word !== undefined) updates.word = word.toLowerCase().trim();
      if (is_active !== undefined) updates.is_active = is_active;

      const { error } = await supabase
        .from("blocked_words")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { id } = params;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Word ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("blocked_words")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-blocked-words error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
