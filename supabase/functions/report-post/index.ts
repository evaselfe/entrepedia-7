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

    const { user_id, post_id, reason, description } = await req.json();

    if (!user_id || !post_id || !reason) {
      return new Response(
        JSON.stringify({ error: "User ID, post ID, and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already reported this post
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", user_id)
      .eq("reported_id", post_id)
      .eq("reported_type", "post")
      .maybeSingle();

    if (existingReport) {
      return new Response(
        JSON.stringify({ error: "You have already reported this post" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the report
    const { error: reportError } = await supabase
      .from("reports")
      .insert({
        reporter_id: user_id,
        reported_id: post_id,
        reported_type: "post",
        reason,
        description: description || null,
      });

    if (reportError) {
      console.error("Report creation error:", reportError);
      return new Response(
        JSON.stringify({ error: "Failed to submit report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update report count on post
    const { data: reportCount } = await supabase
      .from("reports")
      .select("id", { count: "exact" })
      .eq("reported_id", post_id)
      .eq("reported_type", "post");

    const count = reportCount?.length || 0;

    await supabase
      .from("posts")
      .update({ report_count: count })
      .eq("id", post_id);

    // Auto-hide if 10+ reports
    if (count >= 10) {
      await supabase
        .from("posts")
        .update({
          is_hidden: true,
          hidden_at: new Date().toISOString(),
          hidden_reason: "Auto-hidden due to 10+ user reports",
        })
        .eq("id", post_id)
        .eq("is_hidden", false);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Report submitted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Report post error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
