/**
 * List all scan devices and their API keys
 * 
 * Run with: npx tsx scripts/list-devices.ts
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

async function listDevices() {
  console.log("🔍 Listing scan devices...\n");

  try {
    const devices = await prisma.scan_devices.findMany({
      include: {
        gym_areas: {
          include: {
            gyms: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (devices.length === 0) {
      console.log("❌ No scan devices found in the database.");
      console.log("\n💡 Create a scan device first using:");
      console.log("   - SQL directly in your database");
      console.log("   - Prisma Studio: npx prisma studio");
      console.log("   - Or run the test-scan.ts script\n");
      return;
    }

    console.log(`✅ Found ${devices.length} scan device(s):\n`);
    console.log("=".repeat(80));

    devices.forEach((device, index) => {
      console.log(`\n${index + 1}. Device: ${device.name}`);
      console.log(`   ID: ${device.id}`);
      console.log(`   🔑 API Key: ${device.api_key}`);
      console.log(`   Location: ${device.gym_areas.gyms.name} > ${device.gym_areas.name}`);
      console.log(`   Last Seen: ${device.last_seen_at ? device.last_seen_at.toISOString() : "Never"}`);
      
      if (index < devices.length - 1) {
        console.log("-".repeat(80));
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log("\n📋 Example curl command:");
    const firstDevice = devices[0];
    console.log("\ncurl -X POST http://localhost:3000/api/scan \\");
    console.log('  -H "Content-Type: application/json" \\');
    console.log(`  -H "x-api-key: ${firstDevice.api_key}" \\`);
    console.log(`  -d '{"qr_token": "MEMBER_ID_HERE", "device_id": "${firstDevice.id}"}'`);
    console.log("\n");

  } catch (error) {
    console.error("❌ Error listing devices:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

listDevices();
