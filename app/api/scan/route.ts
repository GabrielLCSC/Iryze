/* la route peut servir pour les tests locaux, une edge function identique est utilisée en production */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ScanRequest = await request.json();

    // Validate required fields
    if (!body.qr_token || !body.device_id) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "missing_required_fields",
        } as ScanResponse,
        { status: 400 }
      );
    }

    // Authenticate device via API key from header
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "unauthorized_device",
        } as ScanResponse,
        { status: 401 }
      );
    }

    // Find and validate scan device
    const device = await prisma.scan_devices.findUnique({
      where: { api_key: apiKey },
      include: {
        gym_areas: {
          include: {
            gyms: true,
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "invalid_device",
        } as ScanResponse,
        { status: 401 }
      );
    }

    // Verify device_id matches the authenticated device
    if (device.id !== body.device_id) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "device_mismatch",
        } as ScanResponse,
        { status: 403 }
      );
    }

    // Update device last_seen_at
    await prisma.scan_devices.update({
      where: { id: device.id },
      data: { last_seen_at: new Date() },
    });

    // Get current date (normalized to start of day for proper Date field comparison)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find member by qr_token (which is members.id)
    const member = await prisma.members.findUnique({
      where: { id: body.qr_token },
      include: {
        memberships: {
          where: {
            start_date: { lte: today },
            end_date: { gte: today },
          },
          orderBy: {
            end_date: "desc",
          },
          take: 1,
        },
      },
    });

    // Parse scanned_at or use current time
    const scanTime = body.scanned_at ? new Date(body.scanned_at) : new Date();
    const gymAreaId = device.gym_area_id;

    // If member not found
    if (!member) {
      // Log failed scan
      await prisma.scans.create({
        data: {
          device_id: device.id,
          gym_area_id: gymAreaId,
          scan_time: scanTime,
          status: "denied",
          reason: "member_not_found",
        },
      });

      return NextResponse.json({
        allowed: false,
        reason: "member_not_found",
      } as ScanResponse);
    }

    // Check for active membership
    const activeMembership = member.memberships[0];
    const membershipEndDate = new Date(activeMembership?.end_date);
    membershipEndDate.setHours(0, 0, 0, 0);

    if (membershipEndDate < today || !activeMembership) {
      // Log denied scan
      await prisma.scans.create({
        data: {
          member_id: member.id,
          device_id: device.id,
          gym_area_id: gymAreaId,
          scan_time: scanTime,
          status: "denied",
          reason: "membership_expired",
        },
      });

      return NextResponse.json({
        allowed: false,
        reason: "membership_expired",
      } as ScanResponse);
    }

    // Access granted - log allowed scan
    await prisma.scans.create({
      data: {
        member_id: member.id,
        device_id: device.id,
        gym_area_id: gymAreaId,
        scan_time: scanTime,
        status: "allowed",
      },
    });

    // Return success response
    return NextResponse.json({
      allowed: true,
      member: {
        first_name: member.first_name,
        last_name: member.last_name,
      },
      membership: {
        type: activeMembership.type,
        end_date: activeMembership?.end_date?.toISOString().split("T")[0], // Format as YYYY-MM-DD
      },
    } as ScanResponse);
  } catch (error) {
    console.error("Error processing scan:", error);

    return NextResponse.json(
      {
        allowed: false,
        reason: "internal_error",
      } as ScanResponse,
      { status: 500 }
    );
  }
}
