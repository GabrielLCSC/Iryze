/**
 * List all members with their active memberships
 * 
 * Run with: npx tsx scripts/list-members.ts
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

async function listMembers() {
  console.log("🔍 Listing members...\n");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const members = await prisma.members.findMany({
      include: {
        memberships: {
          where: {
            start_date: { lte: today },
            end_date: { gte: today },
          },
          orderBy: {
            end_date: "desc",
          },
        },
        gyms: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (members.length === 0) {
      console.log("❌ No members found in the database.\n");
      return;
    }

    console.log(`✅ Found ${members.length} member(s):\n`);
    console.log("=".repeat(80));

    members.forEach((member, index) => {
      const hasActiveMembership = member.memberships.length > 0;
      const status = hasActiveMembership ? "✅ Active" : "❌ No Active Membership";

      console.log(`\n${index + 1}. ${member.first_name} ${member.last_name}`);
      console.log(`   ID (QR Token): ${member.id}`);
      console.log(`   Gym: ${member.gyms.name}`);
      console.log(`   Status: ${status}`);

      if (hasActiveMembership) {
        const membership = member.memberships[0];
        console.log(`   Membership Type: ${membership.type}`);
        console.log(`   Valid Until: ${membership.end_date.toISOString().split("T")[0]}`);
      }

      if (index < members.length - 1) {
        console.log("-".repeat(80));
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 Use a member ID as 'qr_token' in your scan request.\n");

  } catch (error) {
    console.error("❌ Error listing members:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

listMembers();
