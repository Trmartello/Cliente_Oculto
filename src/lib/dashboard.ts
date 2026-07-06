import "server-only";
import { prisma } from "./prisma";
import type { Sessao } from "./auth";
import { escopoVisita, escopoNC } from "./rbac";
import { round2 } from "@/domain/score/engine";
import type { Prisma } from "@prisma/client";

export interface FiltrosDashboard {
  postoId?: string;
  inicio?: Date;
  fim?: Date;
  /** Cross-filter estilo BI: indicadores passam a usar o score deste bloco. */
  blocoNome?: string;
}

interface ScoreBlocoSnapshot {
  blocoId: string;
  nome: string;
  peso: number;
  pesoNormalizado: number;
  pontua: boolean;
  score: number | null;
}

export interface DadosDashboard {
  totalVisitas: number;
  scoreMedio: number | null;
  ncsAbertas: number;
  visitasComFalhaCritica: number;
  rankingPostos: {
    postoId: string;
    nome: string;
    visitas: number;
    score: number;
    falhasCriticas: number;
  }[];
  evolucaoMensal: { mes: string; score: number; visitas: number }[];
  scorePorBloco: { nome: string; score: number; importancia: number }[];
  conformidadePorCriticidade: {
    criticidade: string;
    total: number;
    reprovadas: number;
    conformidade: number;
  }[];
  matriz: {
    nome: string;
    importancia: number;
    desempenho: number;
    prioridadeEstrategica: boolean;
  }[];
  oportunidadesPorPosto: {
    postoId: string;
    posto: string;
    oportunidades: { nome: string; desempenho: number; impacto: number }[];
  }[];
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return round2(valores.reduce((s, v) => s + v, 0) / valores.length);
}

export async function carregarDashboard(
  sessao: Sessao,
  filtros: FiltrosDashboard,
): Promise<DadosDashboard> {
  const whereVisita: Prisma.VisitaWhereInput = {
    ...escopoVisita(sessao),
    status: "ENVIADA",
    ...(filtros.postoId ? { postoId: filtros.postoId } : {}),
    ...(filtros.inicio || filtros.fim
      ? {
          dataEnvio: {
            ...(filtros.inicio ? { gte: filtros.inicio } : {}),
            ...(filtros.fim ? { lte: filtros.fim } : {}),
          },
        }
      : {}),
  };

  const [visitas, ncsAbertas, criticidadeGroups] = await Promise.all([
    prisma.visita.findMany({
      where: whereVisita,
      include: { posto: { select: { id: true, nome: true } } },
      orderBy: { dataEnvio: "asc" },
    }),
    prisma.naoConformidade.count({
      where: {
        ...escopoNC(sessao),
        status: { in: ["ABERTA", "EM_ANDAMENTO"] },
        ...(filtros.postoId ? { visita: { postoId: filtros.postoId } } : {}),
        ...(filtros.blocoNome
          ? { pergunta: { bloco: { nome: filtros.blocoNome } } }
          : {}),
      },
    }),
    prisma.resposta.groupBy({
      by: ["criticidadeSnapshot", "reprovada"],
      where: {
        criticidadeSnapshot: { not: null },
        notaObtida: { not: null },
        visita: whereVisita,
        ...(filtros.blocoNome
          ? { pergunta: { bloco: { nome: filtros.blocoNome } } }
          : {}),
      },
      _count: { _all: true },
    }),
  ]);

  // Score de referência da visita: o final ou, no cross-filter, o do bloco.
  function scoreDe(v: (typeof visitas)[number]): number | null {
    if (!filtros.blocoNome) {
      return v.scoreFinal === null ? null : Number(v.scoreFinal);
    }
    const blocos = (v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? [];
    const b = blocos.find((x) => x.nome === filtros.blocoNome);
    return b && b.pontua && b.score !== null ? b.score : null;
  }

  const scores = visitas
    .map(scoreDe)
    .filter((s): s is number => s !== null);

  // ---- Ranking de postos ----
  const porPosto = new Map<
    string,
    { nome: string; scores: number[]; falhas: number }
  >();
  for (const v of visitas) {
    const atual = porPosto.get(v.posto.id) ?? {
      nome: v.posto.nome,
      scores: [],
      falhas: 0,
    };
    const s = scoreDe(v);
    if (s !== null) atual.scores.push(s);
    if (v.temFalhaCritica) atual.falhas += 1;
    porPosto.set(v.posto.id, atual);
  }
  const rankingPostos = [...porPosto.entries()]
    .map(([postoId, d]) => ({
      postoId,
      nome: d.nome,
      visitas: d.scores.length,
      score: media(d.scores) ?? 0,
      falhasCriticas: d.falhas,
    }))
    .sort((a, b) => b.score - a.score);

  // ---- Evolução mensal ----
  const porMes = new Map<string, number[]>();
  for (const v of visitas) {
    const s = scoreDe(v);
    if (s === null || !v.dataEnvio) continue;
    const d = new Date(v.dataEnvio);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    porMes.set(chave, [...(porMes.get(chave) ?? []), s]);
  }
  const evolucaoMensal = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valores]) => ({
      mes,
      score: media(valores) ?? 0,
      visitas: valores.length,
    }));

  // ---- Score e importância por bloco (média dos snapshots) ----
  const porBloco = new Map<string, { scores: number[]; importancias: number[] }>();
  for (const v of visitas) {
    const blocos = (v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? [];
    for (const b of blocos) {
      if (!b.pontua || b.score === null) continue;
      const atual = porBloco.get(b.nome) ?? { scores: [], importancias: [] };
      atual.scores.push(b.score);
      atual.importancias.push(b.pesoNormalizado * 100);
      porBloco.set(b.nome, atual);
    }
  }
  const scorePorBloco = [...porBloco.entries()]
    .map(([nome, d]) => ({
      nome,
      score: media(d.scores) ?? 0,
      importancia: media(d.importancias) ?? 0,
    }))
    .sort((a, b) => b.importancia - a.importancia);

  // ---- Conformidade por criticidade ----
  const porCriticidade = new Map<string, { total: number; reprovadas: number }>();
  for (const g of criticidadeGroups) {
    const c = g.criticidadeSnapshot as string;
    const atual = porCriticidade.get(c) ?? { total: 0, reprovadas: 0 };
    atual.total += g._count._all;
    if (g.reprovada) atual.reprovadas += g._count._all;
    porCriticidade.set(c, atual);
  }
  const ordemCriticidade = ["CRITICA", "ALTA", "MEDIA", "BAIXA"];
  const conformidadePorCriticidade = ordemCriticidade
    .filter((c) => porCriticidade.has(c))
    .map((criticidade) => {
      const d = porCriticidade.get(criticidade)!;
      return {
        criticidade,
        total: d.total,
        reprovadas: d.reprovadas,
        conformidade: round2(((d.total - d.reprovadas) / d.total) * 100),
      };
    });

  // ---- Matriz importância × desempenho (agregada) ----
  const importanciaMedia =
    media(scorePorBloco.map((b) => b.importancia)) ?? 0;
  const matriz = scorePorBloco.map((b) => ({
    nome: b.nome,
    importancia: b.importancia,
    desempenho: b.score,
    prioridadeEstrategica: b.importancia >= importanciaMedia && b.score < 85,
  }));

  // ---- Top-3 oportunidades por posto ----
  const blocosPorPosto = new Map<
    string,
    {
      nome: string;
      blocos: Map<string, { scores: number[]; importancias: number[] }>;
    }
  >();
  for (const v of visitas) {
    const blocos = (v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? [];
    const entrada =
      blocosPorPosto.get(v.posto.id) ??
      { nome: v.posto.nome, blocos: new Map() };
    for (const b of blocos) {
      if (!b.pontua || b.score === null) continue;
      const atual = entrada.blocos.get(b.nome) ?? { scores: [], importancias: [] };
      atual.scores.push(b.score);
      atual.importancias.push(b.pesoNormalizado * 100);
      entrada.blocos.set(b.nome, atual);
    }
    blocosPorPosto.set(v.posto.id, entrada);
  }
  const oportunidadesPorPosto = [...blocosPorPosto.entries()]
    .map(([postoId, { nome: posto, blocos: mapa }]) => ({
      postoId,
      posto,
      oportunidades: [...mapa.entries()]
        .map(([nome, d]) => {
          const desempenho = media(d.scores) ?? 0;
          const importancia = media(d.importancias) ?? 0;
          return {
            nome,
            desempenho,
            impacto: round2((importancia / 100) * (100 - desempenho)),
          };
        })
        .filter((o) => o.impacto > 0)
        .sort((a, b) => b.impacto - a.impacto)
        .slice(0, 3),
    }))
    .filter((p) => p.oportunidades.length > 0)
    .sort((a, b) => a.posto.localeCompare(b.posto));

  return {
    totalVisitas: visitas.length,
    scoreMedio: media(scores),
    ncsAbertas,
    visitasComFalhaCritica: visitas.filter((v) => v.temFalhaCritica).length,
    rankingPostos,
    evolucaoMensal,
    scorePorBloco,
    conformidadePorCriticidade,
    matriz,
    oportunidadesPorPosto,
  };
}
