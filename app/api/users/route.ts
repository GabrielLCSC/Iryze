import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Récupérer tous les membres avec leur first_name
    const members = await prisma.members.findMany({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des membres:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les membres",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

