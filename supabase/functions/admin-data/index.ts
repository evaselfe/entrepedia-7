import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Missing session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate admin session
    const { data: session } = await supabaseAdmin
      .from("user_sessions")
      .select("user_id, expires_at, is_active")
      .eq("session_token", sessionToken)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: No admin roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    let result;

    switch (action) {
      case "get_businesses": {
        const { data, error } = await supabaseAdmin
          .from("businesses")
          .select(`
            *,
            owner:profiles!businesses_owner_id_fkey(full_name, username)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        result = { businesses: data };
        break;
      }

      case "get_communities": {
        const { data, error } = await supabaseAdmin
          .from("communities")
          .select(`
            *,
            creator:profiles!communities_created_by_fkey(full_name, username),
            community_members(count)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform to include member_count
        const communitiesWithCounts = (data || []).map((community) => ({
          ...community,
          member_count: community.community_members?.[0]?.count || 0,
          community_members: undefined,
        }));

        result = { communities: communitiesWithCounts };
        break;
      }

      case "get_jobs": {
        const { data, error } = await supabaseAdmin
          .from("jobs")
          .select(`
            *,
            creator:profiles!jobs_creator_id_fkey(full_name, username),
            job_applications(count)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform to include application_count
        const jobsWithCounts = (data || []).map((job) => ({
          ...job,
          application_count: job.job_applications?.[0]?.count || 0,
          job_applications: undefined,
        }));

        result = { jobs: jobsWithCounts };
        break;
      }

      case "update_business": {
        const { business_id, updates } = body;
        const { error } = await supabaseAdmin
          .from("businesses")
          .update(updates)
          .eq("id", business_id);

        if (error) throw error;

        // Log activity
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: session.user_id,
          action: `Updated business: ${JSON.stringify(updates)}`,
          target_type: "business",
          target_id: business_id,
        });

        result = { success: true };
        break;
      }

      case "update_community": {
        const { community_id, updates } = body;
        const { error } = await supabaseAdmin
          .from("communities")
          .update(updates)
          .eq("id", community_id);

        if (error) throw error;

        // Log activity
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: session.user_id,
          action: `Updated community: ${JSON.stringify(updates)}`,
          target_type: "community",
          target_id: community_id,
        });

        result = { success: true };
        break;
      }

      case "update_job": {
        const { job_id, updates } = body;
        const { error } = await supabaseAdmin
          .from("jobs")
          .update(updates)
          .eq("id", job_id);

        if (error) throw error;

        // Log activity
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: session.user_id,
          action: `Updated job: ${JSON.stringify(updates)}`,
          target_type: "job",
          target_id: job_id,
        });

        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Admin data error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
