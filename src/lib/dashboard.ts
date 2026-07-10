import "server-only";
import { prisma } from "./prisma";
import type { Sessao } from "./auth";
import { escopoVisita } from "./rbac";
import { corteVencimentoUtc } from "./prazos";
import { round2 } from "@/domain/score/engine";
import type { Prisma } from "@prisma/client";

export interface FiltrosDashboard {
  /** Cross-filter estilo BI: seleção múltipla de postos (OR entre eles). */
  postoIds?: string[];
  inicio?: Date;
  fim?: Date;
  /** Meses selecionados na evolução, formato "AAAA-MM" (OR entre eles). */
  meses?: string[];
  /**
   * Blocos selecionados: os indicadores passam a usar a média ponderada
   * (pelos pesos do snapshot) dos scores desses blocos em cada visita.
   */
  blocosNomes?: string[];
  /** Ciclos/campanhas selecionados (OR entre eles). */
  ciclosIds?: string[];
  /** Natureza da avaliação exibida no painel (default: CLIENTE_OCULTO). */
  tipoAvaliacao?: "CLIENTE_OCULTO" | "AUDITORIA_OPERACIONAL";
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
  /** Comparativo entre ciclos/campanhas (visitas com ciclo definido). */
  comparativoCiclos: {
    cicloId: string;
    nome: string;
    score: number;
    visitas: number;
  }[];
  /** Meta de score vigente da rede (score mínimo desejável), se cadastrada. */
  metaScore: number | null;
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return round2(valores.reduce((s, v) => s + v, 0) / valores.length);
}

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export async function carregarDashboard(
  sessao: Sessao,
  filtros: FiltrosDashboard,
): Promise<DadosDashboard> {
  const postoIds = filtros.postoIds ?? [];
  const meses = filtros.meses ?? [];
  const blocosNomes = filtros.blocosNomes ?? [];
  const ciclosIds = filtros.ciclosIds ?? [];

  // Busca sem os filtros de posto/mês (aplicados em memória): assim cada
  // gráfico de ORIGEM continua mostrando todos os seus itens — o ranking
  // exibe todos os postos e a evolução todos os meses, com os não
  // selecionados apenas esmaecidos, como numa ferramenta de BI.
  const wherePeriodo: Prisma.VisitaWhereInput = {
    ...escopoVisita(sessao),
    status: "ENVIADA",
    questionario: { tipo: filtros.tipoAvaliacao ?? "CLIENTE_OCULTO" },
    ...(filtros.inicio || filtros.fim
      ? {
          dataEnvio: {
            ...(filtros.inicio ? { gte: filtros.inicio } : {}),
            ...(filtros.fim ? { lte: filtros.fim } : {}),
          },
        }
      : {}),
  };

  // Versão completa (posto + mês + ciclo) para as agregações no banco.
  const whereVisitaCompleto: Prisma.VisitaWhereInput = {
    ...wherePeriodo,
    ...(postoIds.length ? { postoId: { in: postoIds } } : {}),
    ...(ciclosIds.length ? { cicloId: { in: ciclosIds } } : {}),
    ...(meses.length
      ? {
          AND: [
            {
              OR: meses.map((m) => {
                const [ano, mm] = m.split("-").map(Number);
                return {
                  dataEnvio: {
                    gte: new Date(ano, mm - 1, 1),
                    lt: new Date(ano, mm, 1),
                  },
                };
              }),
            },
          ],
        }
      : {}),
  };

  const filtroBlocoPergunta = blocosNomes.length
    ? { pergunta: { bloco: { nome: { in: blocosNomes } } } }
    : {};

  const corteVigencia = corteVencimentoUtc();
  const [visitasTodas, ncsAbertas, criticidadeGroups, metaVigente] = await Promise.all([
    prisma.visita.findMany({
      where: wherePeriodo,
      include: {
        posto: { select: { id: true, nome: true } },
        ciclo: { select: { id: true, nome: true } },
      },
      orderBy: { dataEnvio: "asc" },
    }),
    prisma.naoConformidade.count({
      where: {
        status: { in: ["ABERTA", "EM_ANDAMENTO"] },
        // o card responde a TODOS os filtros do painel (posto, ciclo, mês,
        // período, aba), como os demais — a visita da NC carrega o recorte
        visita: whereVisitaCompleto,
        ...filtroBlocoPergunta,
      },
    }),
    prisma.resposta.groupBy({
      by: ["criticidadeSnapshot", "reprovada"],
      where: {
        criticidadeSnapshot: { not: null },
        notaObtida: { not: null },
        visita: whereVisitaCompleto,
        ...filtroBlocoPergunta,
      },
      _count: { _all: true },
    }),
    // meta geral da rede vigente (radar/benchmark usam como "aceitável") —
    // vigência é data pura: compara com o dia de hoje em Brasília para a
    // meta valer até o fim do último dia cadastrado
    prisma.meta.findFirst({
      where: {
        blocoNome: null,
        postoId: null,
        AND: [
          { OR: [{ vigenciaInicio: null }, { vigenciaInicio: { lte: corteVigencia } }] },
          { OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: corteVigencia } }] },
        ],
      },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const noPosto = (v: (typeof visitasTodas)[number]) =>
    postoIds.length === 0 || postoIds.includes(v.posto.id);
  const noMes = (v: (typeof visitasTodas)[number]) =>
    meses.length === 0 ||
    (v.dataEnvio !== null && meses.includes(chaveMes(new Date(v.dataEnvio))));
  const noCiclo = (v: (typeof visitasTodas)[number]) =>
    ciclosIds.length === 0 || (v.cicloId !== null && ciclosIds.includes(v.cicloId));

  // Painel (cards, blocos, matriz, oportunidades): todos os filtros.
  const visitas = visitasTodas.filter((v) => noPosto(v) && noMes(v) && noCiclo(v));

  // Score de referência da visita: o final ou, no cross-filter por bloco,
  // a média dos blocos selecionados ponderada pelos pesos do snapshot
  // (com um único bloco selecionado é o próprio score do bloco).
  function scoreDe(v: (typeof visitasTodas)[number]): number | null {
    if (blocosNomes.length === 0) {
      return v.scoreFinal === null ? null : Number(v.scoreFinal);
    }
    const blocos = ((v.scoresPorBloco as unknown as ScoreBlocoSnapshot[]) ?? [])
      .filter(
        (b) => blocosNomes.includes(b.nome) && b.pontua && b.score !== null,
      );
    if (blocos.length === 0) return null;
    const pesoTotal = blocos.reduce((s, b) => s + b.peso, 0);
    if (pesoTotal <= 0) return media(blocos.map((b) => b.score as number));
    return round2(
      blocos.reduce((s, b) => s + b.peso * (b.score as number), 0) / pesoTotal,
    );
  }

  const scores = visitas
    .map(scoreDe)
    .filter((s): s is number => s !== null);

  // ---- Ranking de postos ----
  // Não se filtra pelo próprio posto (o gráfico é a origem desse filtro):
  // mostra todos os postos e o client esmaece os fora da seleção.
  const porPosto = new Map<
    string,
    { nome: string; scores: number[]; falhas: number }
  >();
  for (const v of visitasTodas.filter((x) => noMes(x) && noCiclo(x))) {
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
  // Idem: não se filtra pelos próprios meses selecionados.
  const porMes = new Map<string, number[]>();
  for (const v of visitasTodas.filter((x) => noPosto(x) && noCiclo(x))) {
    const s = scoreDe(v);
    if (s === null || !v.dataEnvio) continue;
    const chave = chaveMes(new Date(v.dataEnvio));
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

  // ---- Comparativo entre ciclos (não se filtra pelos próprios ciclos) ----
  const porCiclo = new Map<string, { nome: string; scores: number[] }>();
  for (const v of visitasTodas.filter((x) => noPosto(x) && noMes(x))) {
    if (!v.ciclo) continue;
    const s = scoreDe(v);
    if (s === null) continue;
    const atual = porCiclo.get(v.ciclo.id) ?? { nome: v.ciclo.nome, scores: [] };
    atual.scores.push(s);
    porCiclo.set(v.ciclo.id, atual);
  }
  const comparativoCiclos = [...porCiclo.entries()].map(([cicloId, d]) => ({
    cicloId,
    nome: d.nome,
    score: media(d.scores) ?? 0,
    visitas: d.scores.length,
  }));

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
    comparativoCiclos,
    metaScore: metaVigente ? Number(metaVigente.scoreMinimo) : null,
  };
}
