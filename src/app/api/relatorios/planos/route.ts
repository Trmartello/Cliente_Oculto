import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoPosto } from "@/lib/rbac";
import { gerarCsv, respostaCsv } from "@/lib/csv";
import {
  ROTULO_STATUS_ACAO_PLANO,
  ROTULO_STATUS_PLANO,
} from "@/lib/formato";
import type { Prisma } from "@prisma/client";

/**
 * Planos de ação exportados até o nível da AÇÃO: uma linha por ação
 * (planos sem ações aparecem com a coluna de ação vazia), respeitando o
 * escopo de acesso.
 */
export async function GET(req: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const where: Prisma.PlanoAcaoWhereInput = {
    posto: escopoPosto(sessao),
    ...(q.get("posto") ? { postoId: q.get("posto")! } : {}),
  };

  const planos = await prisma.planoAcao.findMany({
    where,
    orderBy: [{ status: "asc" }, { atualizadoEm: "desc" }],
    include: {
      posto: { select: { nome: true } },
      iniciativas: {
        orderBy: { ordem: "asc" },
        include: {
          acoes: { orderBy: { criadoEm: "asc" }, include: { responsavel: { select: { nome: true } } } },
        },
      },
    },
  });

  const cabecalhos = [
    "Posto",
    "Etapa",
    "Problema",
    "Status do plano",
    "Iniciativa",
    "Ação",
    "Responsável",
    "Prazo",
    "Status da ação",
    "Progresso (%)",
  ];

  const linhas: unknown[][] = [];
  for (const p of planos) {
    const base = [
      p.posto.nome,
      p.blocoNome ?? "avulso",
      p.problema,
      ROTULO_STATUS_PLANO[p.status] ?? p.status,
    ];
    if (p.iniciativas.length === 0) {
      linhas.push([...base, "", "", "", "", "", ""]);
      continue;
    }
    for (const ini of p.iniciativas) {
      if (ini.acoes.length === 0) {
        linhas.push([...base, ini.titulo, "", "", "", "", ""]);
        continue;
      }
      for (const a of ini.acoes) {
        linhas.push([
          ...base,
          ini.titulo,
          a.titulo,
          a.responsavel?.nome ?? a.responsavelNome ?? "",
          a.dataLimite ? a.dataLimite.toISOString().slice(0, 10) : "",
          ROTULO_STATUS_ACAO_PLANO[a.status] ?? a.status,
          String(a.progresso),
        ]);
      }
    }
  }

  const csv = gerarCsv(cabecalhos, linhas);
  return respostaCsv("planos-de-acao.csv", csv);
}
