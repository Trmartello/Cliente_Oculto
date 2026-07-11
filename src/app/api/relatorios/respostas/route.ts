import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoVisita } from "@/lib/rbac";
import { gerarCsv, respostaCsv } from "@/lib/csv";
import { ROTULO_CRITICIDADE, respostaExibida } from "@/lib/formato";
import { fimDoDiaBrasilia, inicioDoDiaBrasilia } from "@/lib/prazos";
import type { Prisma } from "@prisma/client";

const decimal = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

/**
 * Respostas ITEM A ITEM das avaliações enviadas (a granularidade fina que a
 * Controladoria precisa): uma linha por resposta, com bloco, criticidade,
 * nota, reprovação e comentário — usando o snapshot congelado no envio.
 */
export async function GET(req: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const where: Prisma.VisitaWhereInput = {
    ...escopoVisita(sessao),
    status: "ENVIADA",
    ...(q.get("posto") ? { postoId: q.get("posto")! } : {}),
    ...(q.get("inicio") || q.get("fim")
      ? {
          dataEnvio: {
            ...(q.get("inicio")
              ? { gte: inicioDoDiaBrasilia(q.get("inicio")!) }
              : {}),
            ...(q.get("fim") ? { lte: fimDoDiaBrasilia(q.get("fim")!) } : {}),
          },
        }
      : {}),
  };

  const visitas = await prisma.visita.findMany({
    where,
    orderBy: { dataEnvio: "desc" },
    include: {
      posto: { select: { nome: true } },
      questionario: {
        include: {
          blocos: {
            orderBy: { ordem: "asc" },
            include: { perguntas: { orderBy: { ordem: "asc" } } },
          },
        },
      },
      respostas: true,
    },
  });

  const cabecalhos = [
    "Posto",
    "Data de envio",
    "Avaliador",
    "Bloco",
    "Pergunta",
    "Criticidade",
    "Resposta",
    "Nota obtida",
    "Nota máxima",
    "Reprovada",
    "Comentário",
  ];

  const linhas: unknown[][] = [];
  for (const v of visitas) {
    const respPorPergunta = new Map(v.respostas.map((r) => [r.perguntaId, r]));
    const dataEnvio = v.dataEnvio ? v.dataEnvio.toISOString().slice(0, 10) : "";
    for (const bloco of v.questionario.blocos) {
      for (const p of bloco.perguntas) {
        const r = respPorPergunta.get(p.id);
        const ex = r ? respostaExibida(r) : null;
        linhas.push([
          v.posto.nome,
          dataEnvio,
          v.avaliadorNome ?? "",
          bloco.nome,
          p.texto,
          ROTULO_CRITICIDADE[p.criticidade] ?? p.criticidade,
          ex?.naoSeAplica ? "Não se aplica" : (ex?.valor ?? ""),
          decimal(r?.notaObtida),
          decimal(r?.notaMaximaSnapshot ?? p.notaMaxima),
          r?.reprovada ? "Sim" : "Não",
          ex?.comentario ?? "",
        ]);
      }
    }
  }

  const csv = gerarCsv(cabecalhos, linhas);
  return respostaCsv("respostas-avaliacoes.csv", csv);
}
