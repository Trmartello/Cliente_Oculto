import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health-check para monitoramento (uptime robots, Railway healthcheck):
 * confirma que a aplicação sobe E consegue falar com o banco. Público e
 * leve — não expõe dados. Retorna 200 quando saudável, 503 caso contrário.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", banco: "ok" });
  } catch {
    return NextResponse.json(
      { status: "erro", banco: "indisponivel" },
      { status: 503 },
    );
  }
}
