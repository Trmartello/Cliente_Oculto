import type {
  BlocoConfig,
  FalhaCritica,
  NcACriar,
  PerguntaConfig,
  QuestionarioConfig,
  RespostaInput,
  ResultadoAvaliacao,
  ResultadoBloco,
  ResultadoPergunta,
} from "./tipos";
import { faixaIgeo } from "./igeo";
import { calcularMatriz } from "./matriz";

const LIMIAR_REPROVACAO_PADRAO = 0.4;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TIPOS_PONTUAVEIS = new Set([
  "SIM_NAO",
  "NOTA_1_5",
  "NOTA_1_10",
  "ATENDE_NAO_ATENDE",
]);

function notaObtidaDe(
  pergunta: PerguntaConfig,
  valor: string,
): number | null {
  switch (pergunta.tipo) {
    case "SIM_NAO":
      return valor === "SIM" ? pergunta.notaMaxima : 0;
    case "ATENDE_NAO_ATENDE":
      return valor === "ATENDE" ? pergunta.notaMaxima : 0;
    case "NOTA_1_5":
    case "NOTA_1_10": {
      const n = Number(valor);
      if (!Number.isFinite(n)) return null;
      return Math.min(Math.max(n, 0), pergunta.notaMaxima);
    }
    default:
      return null;
  }
}

interface PerguntaAvaliada extends ResultadoPergunta {
  razao: number | null; // notaObtida / notaMaxima
}

function avaliarPergunta(
  bloco: BlocoConfig,
  pergunta: PerguntaConfig,
  resposta: RespostaInput | undefined,
  limiarReprovacao: number,
): PerguntaAvaliada {
  const base: PerguntaAvaliada = {
    perguntaId: pergunta.id,
    blocoId: bloco.id,
    texto: pergunta.texto,
    tipo: pergunta.tipo,
    criticidade: pergunta.criticidade,
    naoSeAplica: resposta?.naoSeAplica === true,
    pontua: false,
    notaObtida: null,
    notaMaxima: pergunta.notaMaxima,
    peso: pergunta.peso,
    pesoNormalizado: 0,
    scoreItem: null,
    reprovada: false,
    razao: null,
  };

  // TEXTO/FOTO são informativas; N/A e perguntas sem resposta ficam fora
  // do cálculo (a obrigatoriedade é validada antes do envio).
  if (!TIPOS_PONTUAVEIS.has(pergunta.tipo)) return base;
  if (base.naoSeAplica) return base;
  if (resposta?.valor == null || resposta.valor === "") return base;

  const nota = notaObtidaDe(pergunta, resposta.valor);
  if (nota === null || pergunta.notaMaxima <= 0) return base;

  const razao = nota / pergunta.notaMaxima;
  return {
    ...base,
    pontua: true,
    notaObtida: nota,
    razao,
    reprovada: razao <= limiarReprovacao,
  };
}

/**
 * Motor de Score Ponderado.
 *
 * - Pesos de perguntas e blocos são sempre normalizados pela soma real,
 *   então funcionam quer somem 100 quer não.
 * - Perguntas N/A, sem resposta ou informativas (TEXTO/FOTO) são excluídas
 *   e os pesos restantes do bloco são renormalizados; bloco inteiramente
 *   excluído renormaliza os blocos restantes.
 * - Falha crítica (pergunta CRITICA reprovada) aplica a penalidade
 *   parametrizada do questionário e gera Não Conformidade automática.
 */
export function calcularScore(
  config: QuestionarioConfig,
  respostas: RespostaInput[],
): ResultadoAvaliacao {
  const limiarReprovacao = config.limiarReprovacao ?? LIMIAR_REPROVACAO_PADRAO;
  const porPerguntaId = new Map(respostas.map((r) => [r.perguntaId, r]));

  const porPergunta: ResultadoPergunta[] = [];
  const blocosAvaliados: {
    bloco: BlocoConfig;
    score: number | null;
    pontua: boolean;
  }[] = [];
  const falhasCriticas: FalhaCritica[] = [];

  for (const bloco of config.blocos) {
    const avaliadas = bloco.perguntas.map((p) =>
      avaliarPergunta(bloco, p, porPerguntaId.get(p.id), limiarReprovacao),
    );

    const pontuaveis = avaliadas.filter((a) => a.pontua);
    const somaPesos = pontuaveis.reduce((s, a) => s + a.peso, 0);

    let scoreBloco: number | null = null;
    if (pontuaveis.length > 0 && somaPesos > 0) {
      scoreBloco = 0;
      for (const a of pontuaveis) {
        a.pesoNormalizado = a.peso / somaPesos;
        a.scoreItem = (a.razao as number) * a.pesoNormalizado * 100;
        scoreBloco += a.scoreItem;
      }
    }

    for (const a of avaliadas) {
      if (a.pontua && a.reprovada && a.criticidade === "CRITICA") {
        falhasCriticas.push({
          perguntaId: a.perguntaId,
          blocoId: bloco.id,
          texto: a.texto,
        });
      }
      const { razao: _razao, ...resultado } = a;
      void _razao;
      porPergunta.push({
        ...resultado,
        scoreItem: a.scoreItem === null ? null : round2(a.scoreItem),
      });
    }

    blocosAvaliados.push({
      bloco,
      score: scoreBloco,
      pontua: scoreBloco !== null,
    });
  }

  // Score final: média ponderada dos blocos que pontuam.
  const blocosPontuaveis = blocosAvaliados.filter((b) => b.pontua);
  const somaPesosBlocos = blocosPontuaveis.reduce(
    (s, b) => s + b.bloco.peso,
    0,
  );

  const porBloco: ResultadoBloco[] = blocosAvaliados.map((b) => ({
    blocoId: b.bloco.id,
    nome: b.bloco.nome,
    peso: b.bloco.peso,
    pesoNormalizado:
      b.pontua && somaPesosBlocos > 0 ? b.bloco.peso / somaPesosBlocos : 0,
    pontua: b.pontua,
    score: b.score === null ? null : round2(b.score),
  }));

  let scoreBruto: number | null = null;
  if (blocosPontuaveis.length > 0 && somaPesosBlocos > 0) {
    scoreBruto = blocosAvaliados.reduce((s, b) => {
      if (!b.pontua || b.score === null) return s;
      return s + b.score * (b.bloco.peso / somaPesosBlocos);
    }, 0);
  }

  // Penalidade por falha crítica — aplicada uma única vez, conforme regra
  // parametrizada do questionário.
  const temFalhaCritica = falhasCriticas.length > 0;
  let scoreFinal = scoreBruto;
  if (scoreBruto !== null && temFalhaCritica) {
    switch (config.penalidadeCriticaTipo) {
      case "PERCENTUAL":
        scoreFinal = scoreBruto * (1 - config.penalidadeCriticaValor / 100);
        break;
      case "TETO":
        scoreFinal = Math.min(scoreBruto, config.penalidadeCriticaValor);
        break;
      case "NENHUMA":
        scoreFinal = scoreBruto;
        break;
    }
  }

  scoreBruto = scoreBruto === null ? null : round2(scoreBruto);
  scoreFinal = scoreFinal === null ? null : round2(Math.max(0, scoreFinal!));

  // Não conformidades automáticas.
  const nomeBloco = new Map(config.blocos.map((b) => [b.id, b.nome]));
  const ncsACriar: NcACriar[] = falhasCriticas.map((f) => ({
    origem: "FALHA_CRITICA",
    perguntaId: f.perguntaId,
    descricao: `Falha crítica: "${f.texto}" (bloco ${nomeBloco.get(f.blocoId) ?? ""})`,
    prioridade: "URGENTE",
  }));

  const meta = config.metaScoreMinimo;
  if (meta != null && scoreFinal !== null && scoreFinal < meta) {
    ncsACriar.push({
      origem: "SCORE_ABAIXO_META",
      perguntaId: null,
      descricao: `Score final ${scoreFinal.toFixed(2)} abaixo da meta de ${meta.toFixed(2)}.`,
      prioridade: "ALTA",
    });
  }

  return {
    porPergunta,
    porBloco,
    scoreBruto,
    scoreFinal,
    faixaIgeo: scoreFinal === null ? null : faixaIgeo(scoreFinal),
    temFalhaCritica,
    falhasCriticas,
    ncsACriar,
    matriz: calcularMatriz(
      porBloco,
      config.limiarPrioridadeEstrategica ?? 85,
    ),
  };
}
