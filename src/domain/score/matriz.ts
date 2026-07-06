import type {
  Oportunidade,
  PontoMatriz,
  ResultadoBloco,
  ResultadoMatriz,
} from "./tipos";
import { round2 } from "./engine";

/**
 * Matriz Importância × Desempenho.
 *
 * Eixo X = desempenho do bloco (score 0-100); eixo Y = importância
 * estratégica (peso normalizado em %). Blocos com importância acima da
 * média e desempenho abaixo do limiar são prioridades estratégicas.
 * As top-3 oportunidades são os blocos com maior `importância × gap`.
 */
export function calcularMatriz(
  porBloco: ResultadoBloco[],
  limiarDesempenho: number,
): ResultadoMatriz {
  const blocos = porBloco.filter((b) => b.pontua && b.score !== null);
  if (blocos.length === 0) {
    return { pontos: [], prioridadesEstrategicas: [], topOportunidades: [] };
  }

  const importancias = blocos.map((b) => b.pesoNormalizado * 100);
  const mediaImportancia =
    importancias.reduce((s, i) => s + i, 0) / importancias.length;

  const pontos: PontoMatriz[] = blocos.map((b) => {
    const importancia = round2(b.pesoNormalizado * 100);
    const desempenho = b.score as number;
    return {
      blocoId: b.blocoId,
      nome: b.nome,
      importancia,
      desempenho,
      prioridadeEstrategica:
        importancia >= mediaImportancia && desempenho < limiarDesempenho,
    };
  });

  const topOportunidades: Oportunidade[] = pontos
    .map((p) => ({
      blocoId: p.blocoId,
      nome: p.nome,
      importancia: p.importancia,
      desempenho: p.desempenho,
      impacto: round2((p.importancia / 100) * (100 - p.desempenho)),
    }))
    .filter((o) => o.impacto > 0)
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 3);

  return {
    pontos,
    prioridadesEstrategicas: pontos.filter((p) => p.prioridadeEstrategica),
    topOportunidades,
  };
}
