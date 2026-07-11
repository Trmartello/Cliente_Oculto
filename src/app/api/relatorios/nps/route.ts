import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoPosto } from "@/lib/rbac";
import { gerarCsv, respostaCsv } from "@/lib/csv";
import { fimDoDiaBrasilia, inicioDoDiaBrasilia } from "@/lib/prazos";
import type { Prisma } from "@prisma/client";

function categoria(nota: number): string {
  if (nota >= 9) return "Promotor";
  if (nota >= 7) return "Neutro";
  return "Detrator";
}

/**
 * Respostas da pesquisa de NPS: uma linha por resposta, com posto, nota,
 * categoria (promotor/neutro/detrator) e comentário. Respeita o escopo.
 */
export async function GET(req: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const where: Prisma.RespostaNpsWhereInput = {
    pesquisa: {
      posto: {
        ...escopoPosto(sessao),
        ...(q.get("posto") ? { id: q.get("posto")! } : {}),
      },
    },
    ...(q.get("inicio") || q.get("fim")
      ? {
          criadoEm: {
            ...(q.get("inicio")
              ? { gte: inicioDoDiaBrasilia(q.get("inicio")!) }
              : {}),
            ...(q.get("fim") ? { lte: fimDoDiaBrasilia(q.get("fim")!) } : {}),
          },
        }
      : {}),
  };

  const respostas = await prisma.respostaNps.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    include: { pesquisa: { include: { posto: { select: { nome: true } } } } },
  });

  const cabecalhos = ["Posto", "Data", "Nota", "Categoria", "Comentário"];
  const linhas = respostas.map((r) => [
    r.pesquisa.posto.nome,
    r.criadoEm.toISOString().slice(0, 10),
    String(r.nota),
    categoria(r.nota),
    r.comentario ?? "",
  ]);

  const csv = gerarCsv(cabecalhos, linhas);
  return respostaCsv("respostas-nps.csv", csv);
}
