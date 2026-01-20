import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, mobile_number, otp, new_password } = await req.json();

    if (action === "request_otp") {
      // Validate mobile number
      if (!mobile_number || !/^[0-9]{10}$/.test(mobile_number)) {
        return new Response(
          JSON.stringify({ error: "Please enter a valid 10-digit mobile number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if mobile number exists
      const { data: existingUser } = await supabase
        .from("user_credentials")
        .select("id")
        .eq("mobile_number", mobile_number)
        .maybeSingle();

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "No account found with this mobile number" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete any existing OTPs for this mobile number
      await supabase
        .from("password_reset_otps")
        .delete()
        .eq("mobile_number", mobile_number);

      // Generate and store OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { error: otpError } = await supabase
        .from("password_reset_otps")
        .insert({
          mobile_number,
          otp_code: otpCode,
          expires_at: expiresAt,
        });

      if (otpError) {
        console.error("OTP creation error:", otpError);
        return new Response(
          JSON.stringify({ error: "Failed to generate OTP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // TODO: Integrate with SMS service (Twilio, MSG91, etc.) to send OTP
      // For now, we'll log it for testing purposes
      console.log(`OTP for ${mobile_number}: ${otpCode}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP sent successfully",
          // In production, remove this - only for testing
          debug_otp: otpCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    else if (action === "verify_otp") {
      if (!mobile_number || !otp) {
        return new Response(
          JSON.stringify({ error: "Mobile number and OTP are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find valid OTP
      const { data: otpRecord } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("mobile_number", mobile_number)
        .eq("otp_code", otp)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP verified successfully",
          verified: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    else if (action === "reset_password") {
      if (!mobile_number || !otp || !new_password) {
        return new Response(
          JSON.stringify({ error: "Mobile number, OTP, and new password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify OTP again
      const { data: otpRecord } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("mobile_number", mobile_number)
        .eq("otp_code", otp)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash new password
      const passwordHash = await hashPassword(new_password);

      // Update password
      const { error: updateError } = await supabase
        .from("user_credentials")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("mobile_number", mobile_number);

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark OTP as used
      await supabase
        .from("password_reset_otps")
        .update({ is_used: true })
        .eq("id", otpRecord.id);

      // Invalidate all sessions for this user
      const { data: credentials } = await supabase
        .from("user_credentials")
        .select("id")
        .eq("mobile_number", mobile_number)
        .single();

      if (credentials) {
        await supabase
          .from("user_sessions")
          .update({ is_active: false })
          .eq("user_id", credentials.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password reset successfully. Please sign in with your new password.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
