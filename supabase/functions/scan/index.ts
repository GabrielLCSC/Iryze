/// <reference types="./deno.d.ts" />

/**
 * Supabase Edge Function - Scan Endpoint
 * 
 * This handles QR code scans from hardware devices.
 * Deployed independently from the Next.js dashboard.
 * 
 * Deploy with:
 *   supabase functions deploy scan
 * 
 * Note: This runs on Deno, not Node.js. IDE errors are expected.
 * The code will work correctly when deployed to Supabase.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ScanRequest {
  qr_token: string; // This will be members.id (UUID)
  device_id: string; // UUID of scan device
  scanned_at?: string; // ISO timestamp (optional)
}

interface ScanResponse {
  allowed: boolean;
  member?: {
    first_name: string;
    last_name: string;
  };
  membership?: {
    type: string;
    end_date: string;
  };
  reason?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "unauthorized_device",
        } as ScanResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: ScanRequest = await req.json();

    // Validate required fields
    if (!body.qr_token || !body.device_id) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "missing_required_fields",
        } as ScanResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    // SUPABASE_URL is automatically available in Edge Functions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Service role key must be set as a secret (without SUPABASE_ prefix)
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and validate scan device
    const { data: device, error: deviceError } = await supabase
      .from("scan_devices")
      .select(
        `
        id,
        gym_area_id,
        name,
        gym_areas!inner (
          id,
          name,
          gyms!inner (
            id,
            name
          )
        )
      `
      )
      .eq("api_key", apiKey)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "invalid_device",
        } as ScanResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify device_id matches the authenticated device
    if (device.id !== body.device_id) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "device_mismatch",
        } as ScanResponse),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update device last_seen_at
    await supabase
      .from("scan_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    // Get current date (normalized to start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find member by qr_token (which is members.id)
    // First, get the member with all memberships
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select(
        `
        id,
        first_name,
        last_name,
        memberships (
          id,
          start_date,
          end_date,
          type
        )
      `
      )
      .eq("id", body.qr_token)
      .single();

    // Filter active memberships in JavaScript (more reliable than Supabase filters on relations)
    interface Membership {
      id: string;
      start_date: string;
      end_date: string;
      type: string;
    }

    let activeMembership: Membership | null = null;
    if (member && member.memberships) {
      const activeMemberships = (member.memberships as Membership[])
        .filter((m: Membership) => {
          const startDate = new Date(m.start_date);
          const endDate = new Date(m.end_date);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return startDate <= today && endDate >= today;
        })
        .sort((a: Membership, b: Membership) => {
          return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
        });

      activeMembership = activeMemberships[0] || null;
    }

    // Parse scanned_at or use current time
    const scanTime = body.scanned_at
      ? new Date(body.scanned_at)
      : new Date();
    const gymAreaId = device.gym_area_id;

    // If member not found
    if (memberError || !member) {
      // Log failed scan
      await supabase.from("scans").insert({
        device_id: device.id,
        gym_area_id: gymAreaId,
        scan_time: scanTime.toISOString(),
        status: "denied",
        reason: "member_not_found",
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "member_not_found",
        } as ScanResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for active membership (already filtered above)

    if (!activeMembership) {
      // Log denied scan
      await supabase.from("scans").insert({
        member_id: member.id,
        device_id: device.id,
        gym_area_id: gymAreaId,
        scan_time: scanTime.toISOString(),
        status: "denied",
        reason: "membership_expired",
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "membership_expired",
        } as ScanResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Double-check: Verify that end_date is >= today (explicit validation)
    const membershipEndDate = new Date(activeMembership.end_date);
    membershipEndDate.setHours(0, 0, 0, 0);

    if (membershipEndDate < today) {
      // Log denied scan - membership expired
      await supabase.from("scans").insert({
        member_id: member.id,
        device_id: device.id,
        gym_area_id: gymAreaId,
        scan_time: scanTime.toISOString(),
        status: "denied",
        reason: "membership_expired",
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "membership_expired",
        } as ScanResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Access granted - log allowed scan
    await supabase.from("scans").insert({
      member_id: member.id,
      device_id: device.id,
      gym_area_id: gymAreaId,
      scan_time: scanTime.toISOString(),
      status: "allowed",
    });

    // Return success response
    return new Response(
      JSON.stringify({
        allowed: true,
        member: {
          first_name: member.first_name,
          last_name: member.last_name,
        },
        membership: {
          type: activeMembership.type,
          end_date: activeMembership.end_date,
        },
      } as ScanResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing scan:", error);

    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "internal_error",
      } as ScanResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
