import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action, user_id, business_id, ...updateData } = await req.json();

    console.log("Manage business - action:", action, "user:", user_id, "business:", business_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle list action - returns user's businesses with all statuses (bypasses RLS)
    if (action === "list") {
      const { data: businesses, error: listError } = await supabase
        .from("businesses")
        .select("id, name, description, category, logo_url, location, approval_status, owner_id")
        .eq("owner_id", user_id)
        .order("created_at", { ascending: false });

      if (listError) {
        console.error("List businesses error:", listError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch businesses" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get follower counts for each business
      const enrichedBusinesses = await Promise.all(
        (businesses || []).map(async (business) => {
          const { count } = await supabase
            .from("business_follows")
            .select("*", { count: "exact", head: true })
            .eq("business_id", business.id);

          return {
            ...business,
            follower_count: count || 0,
          };
        })
      );

      console.log("Found", enrichedBusinesses.length, "businesses for user", user_id);
      return new Response(
        JSON.stringify({ success: true, businesses: enrichedBusinesses }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "Business ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the business
    const { data: business, error: checkError } = await supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", business_id)
      .single();

    if (checkError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (business.owner_id !== user_id) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to manage this business" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { error: deleteError } = await supabase
        .from("businesses")
        .delete()
        .eq("id", business_id);

      if (deleteError) {
        console.error("Delete business error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete business" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Business deleted successfully");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const allowedFields = [
        'name', 'description', 'category', 'location', 
        'logo_url', 'cover_image_url', 'website_url', 
        'instagram_link', 'youtube_link'
      ];
      
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      const { data: updatedBusiness, error: updateError } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", business_id)
        .select()
        .single();

      if (updateError) {
        console.error("Update business error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update business" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Business updated successfully");
      return new Response(
        JSON.stringify({ success: true, business: updatedBusiness }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'update' or 'delete'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Manage business error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
