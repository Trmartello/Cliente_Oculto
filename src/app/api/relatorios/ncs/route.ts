import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoNC } from "@/lib/rbac";
import { gerarCsv, respostaCsv } from "@/lib/csv";
import {
  ROTULO_ORIGEM_NC,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_NC,
} from "@/lib/formato";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const where: Prisma.NaoConformidadeWhereInput = {
    ...escopoNC(sessao),
    ...(q.get("posto") ? { visita: { postoId: q.get("posto")! } } : {}),
    ...(q.get("inicio") || q.get("fim")
      ? {
          criadoEm: {
            ...(q.get("inicio") ? { gte: new Date(q.get("inicio")!) } : {}),
            ...(q.get("fim")
              ? { lte: new Date(`${q.get("fim")}T23:59:59`) }
              : {}),
          },
        }
      : {}),
  };

  const ncs = await prisma.naoConformidade.findMany({
    where,
    include: {
      visita: { include: { posto: true } },
      pergunta: true,
      responsavel: true,
      _count: { select: { acoes: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  const cabecalhos = [
    "Posto",
    "Região",
    "Origem",
    "Descrição",
    "Pergunta",
    "Prioridade",
    "Status",
    "Responsável",
    "Prazo",
    "Criada em",
    "Concluída em",
    "Qtde. ações",
  ];

  const linhas = ncs.map((nc) => [
    nc.visita.posto.nome,
    nc.visita.posto.regiao,
    ROTULO_ORIGEM_NC[nc.origem],
    nc.descricao,
    nc.pergunta?.texto ?? "",
    ROTULO_PRIORIDADE[nc.prioridade],
    ROTULO_STATUS_NC[nc.status],
    nc.responsavel?.nome ?? "",
    nc.prazo ? nc.prazo.toISOString().slice(0, 10) : "",
    nc.criadoEm.toISOString().slice(0, 10),
    nc.dataConclusao ? nc.dataConclusao.toISOString().slice(0, 10) : "",
    nc._count.acoes,
  ]);

  return respostaCsv("nao-conformidades.csv", gerarCsv(cabecalhos, linhas));
}
