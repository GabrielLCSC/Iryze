/**
 * Test script to create test data for the /scan endpoint
 * 
 * This script creates:
 * - A gym owner (user)
 * - A gym
 * - A gym area
 * - A scan device with an API key
 * - A member with an active membership
 * 
 * Run with: npx tsx scripts/test-scan.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load .env.local first, then .env (local takes precedence)
// This ensures .env.local overrides .env values
const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");

config({ path: envLocalPath });
config({ path: envPath });

const connectionString = process.env.POOLER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ POOLER_URL ou DATABASE_URL manquante dans .env");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createTestData() {
  console.log("🧪 Creating test data for /scan endpoint...\n");

  try {
    // 1. Create a user in auth schema (for gym owner)
    // Note: In production, you'd use Supabase Auth. For testing, we'll need to create this manually
    // or use Supabase client. For now, we'll assume you have a user ID.
    console.log("⚠️  You need to create a user in auth.users first, then use its ID.");
    console.log("   Or use an existing user ID from your database.\n");

    // For this example, we'll generate a UUID and assume it exists
    // In practice, create the user via Supabase Auth first
    const ownerUserId = "00000000-0000-0000-0000-000000000001"; // Replace with actual user ID
    
    // Check if gym_owner exists, if not create it
    let owner = await prisma.gym_owners.findUnique({
      where: { id: ownerUserId },
    });

    if (!owner) {
      console.log("📝 Creating gym owner...");
      owner = await prisma.gym_owners.create({
        data: { id: ownerUserId },
      });
      console.log("✅ Gym owner created:", owner.id);
    } else {
      console.log("✅ Gym owner already exists:", owner.id);
    }

    // 2. Create a gym
    let gym = await prisma.gyms.findFirst({
      where: { owner_id: ownerUserId },
    });

    if (!gym) {
      console.log("📝 Creating gym...");
      gym = await prisma.gyms.create({
        data: {
          owner_id: ownerUserId,
          name: "Test Gym",
          address: "123 Test Street",
        },
      });
      console.log("✅ Gym created:", gym.id, "-", gym.name);
    } else {
      console.log("✅ Gym already exists:", gym.id, "-", gym.name);
    }

    // 3. Create a gym area
    let gymArea = await prisma.gym_areas.findFirst({
      where: { gym_id: gym.id },
    });

    if (!gymArea) {
      console.log("📝 Creating gym area...");
      gymArea = await prisma.gym_areas.create({
        data: {
          gym_id: gym.id,
          name: "Main Entrance",
        },
      });
      console.log("✅ Gym area created:", gymArea.id, "-", gymArea.name);
    } else {
      console.log("✅ Gym area already exists:", gymArea.id, "-", gymArea.name);
    }

    // 4. Create a scan device with API key
    // Generate a secure API key (in production, use crypto.randomBytes or similar)
    const apiKey = `test_device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    let scanDevice = await prisma.scan_devices.findFirst({
      where: { gym_area_id: gymArea.id },
    });

    if (!scanDevice) {
      console.log("📝 Creating scan device...");
      scanDevice = await prisma.scan_devices.create({
        data: {
          gym_area_id: gymArea.id,
          name: "Test Scanner Device",
          api_key: apiKey,
        },
      });
      console.log("✅ Scan device created:", scanDevice.id);
      console.log("🔑 API KEY:", apiKey);
      console.log("   ⚠️  Save this API key - you'll need it to test the endpoint!\n");
    } else {
      console.log("✅ Scan device already exists:", scanDevice.id);
      console.log("🔑 API KEY:", scanDevice.api_key, "\n");
      // Update the apiKey variable for later use
      if (!scanDevice.api_key) {
        await prisma.scan_devices.update({
          where: { id: scanDevice.id },
          data: { api_key: apiKey },
        });
        console.log("🔑 Generated new API KEY:", apiKey, "\n");
      }
    }

    // 5. Create a member (also needs a user in auth.users)
    const memberUserId = "00000000-0000-0000-0000-000000000002"; // Replace with actual user ID
    let member = await prisma.members.findUnique({
      where: { id: memberUserId },
    });

    if (!member) {
      console.log("📝 Creating member...");
      console.log("⚠️  You need to create a user in auth.users first, then use its ID.");
      console.log("   Member ID will be the same as user ID.\n");
      member = await prisma.members.create({
        data: {
          id: memberUserId,
          gym_id: gym.id,
          first_name: "Alex",
          last_name: "Martin",
          birthdate: new Date("1990-01-15"),
        },
      });
      console.log("✅ Member created:", member.id, "-", member.first_name, member.last_name);
    } else {
      console.log("✅ Member already exists:", member.id, "-", member.first_name, member.last_name);
    }

    // 6. Create an active membership
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const activeMembership = await prisma.memberships.findFirst({
      where: {
        member_id: member.id,
        start_date: { lte: today },
        end_date: { gte: today },
      },
    });

    if (!activeMembership) {
      console.log("📝 Creating active membership...");
      const membership = await prisma.memberships.create({
        data: {
          member_id: member.id,
          start_date: today,
          end_date: nextMonth,
          type: "mensuel",
        },
      });
      console.log("✅ Membership created:", membership.id);
      console.log("   Valid from", membership.start_date.toISOString().split("T")[0]);
      console.log("   Valid until", membership.end_date.toISOString().split("T")[0]);
    } else {
      console.log("✅ Active membership already exists:", activeMembership.id);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Test data created successfully!");
    console.log("=".repeat(60));
    console.log("\n📋 Test Information:");
    console.log("   Device ID:", scanDevice.id);
    console.log("   Device API Key:", scanDevice.api_key || apiKey);
    console.log("   Member ID (QR Token):", member.id);
    console.log("\n🧪 Test the endpoint with:");
    console.log("\ncurl -X POST http://localhost:3000/api/scan \\");
    console.log('  -H "Content-Type: application/json" \\');
    console.log(`  -H "x-api-key: ${scanDevice.api_key || apiKey}" \\`);
    console.log(`  -d '{"qr_token": "${member.id}", "device_id": "${scanDevice.id}"}'`);
    console.log("\n");

  } catch (error) {
    console.error("❌ Error creating test data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

createTestData();
