import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoVisita } from "@/lib/rbac";
import { gerarCsv, respostaCsv } from "@/lib/csv";
import { ROTULO_FAIXA } from "@/lib/formato";
import type { Prisma } from "@prisma/client";

interface ScoreBlocoSnapshot {
  nome: string;
  pontua: boolean;
  score: number | null;
}

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
            ...(q.get("inicio") ? { gte: new Date(q.get("inicio")!) } : {}),
            ...(q.get("fim")
              ? { lte: new Date(`${q.get("fim")}T23:59:59`) }
              : {}),
          },
        }
      : {}),
  };

  const visitas = await prisma.visita.findMany({
    where,
    include: { posto: true, questionario: true },
    orderBy: { dataEnvio: "desc" },
  });

  // Colunas dinâmicas: um bloco pode existir em uns questionários e não em
  // outros — usa a união de nomes presentes nos snapshots.
  const nomesBlocos = [
    ...new Set(
      visitas.flatMap((v) =>
        (((v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? []).map(
          (b) => b.nome,
        )),
      ),
    ),
  ];

  const cabecalhos = [
    "Posto",
    "Código",
    "Cidade",
    "UF",
    "Região",
    "Questionário",
    "Avaliador",
    "Data de envio",
    "Score bruto",
    "Score final",
    "Faixa IGEO",
    "Falha crítica",
    ...nomesBlocos.map((n) => `Bloco: ${n}`),
  ];

  const linhas = visitas.map((v) => {
    const blocos =
      (v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? [];
    const scorePorNome = new Map(blocos.map((b) => [b.nome, b.score]));
    return [
      v.posto.nome,
      v.posto.codigo,
      v.posto.cidade,
      v.posto.uf,
      v.posto.regiao,
      `${v.questionario.nome} (v${v.questionario.versao})`,
      v.avaliadorNome ?? "",
      v.dataEnvio ? v.dataEnvio.toISOString().slice(0, 10) : "",
      v.scoreBruto !== null ? String(v.scoreBruto).replace(".", ",") : "",
      v.scoreFinal !== null ? String(v.scoreFinal).replace(".", ",") : "",
      v.faixaIgeo ? ROTULO_FAIXA[v.faixaIgeo] : "",
      v.temFalhaCritica ? "Sim" : "Não",
      ...nomesBlocos.map((n) => {
        const s = scorePorNome.get(n);
        return s !== undefined && s !== null
          ? String(s).replace(".", ",")
          : "";
      }),
    ];
  });

  return respostaCsv("avaliacoes.csv", gerarCsv(cabecalhos, linhas));
}
