// Tipos do domínio de avaliação — TypeScript puro, sem dependência de
// Prisma ou Next.js, para que o motor seja testável e portável.

export type TipoPergunta =
  | "SIM_NAO"
  | "NOTA_1_5"
  | "NOTA_1_10"
  | "ATENDE_NAO_ATENDE"
  | "TEXTO"
  | "FOTO";

export type Criticidade = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type TipoPenalidadeCritica = "NENHUMA" | "PERCENTUAL" | "TETO";

export type FaixaIgeo =
  | "EXCELENCIA"
  | "MUITO_BOM"
  | "BOM"
  | "REGULAR"
  | "CRITICO";

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export type OrigemNC = "FALHA_CRITICA" | "SCORE_ABAIXO_META";

export interface PerguntaConfig {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  peso: number;
  criticidade: Criticidade;
  obrigatoria: boolean;
  permiteNaoSeAplica: boolean;
  notaMaxima: number;
}

export interface BlocoConfig {
  id: string;
  nome: string;
  peso: number;
  perguntas: PerguntaConfig[];
}

export interface QuestionarioConfig {
  blocos: BlocoConfig[];
  penalidadeCriticaTipo: TipoPenalidadeCritica;
  penalidadeCriticaValor: number;
  /**
   * Fração da nota máxima abaixo da qual (inclusive) uma pergunta de nota
   * é considerada reprovada. Default 0.4 (ex.: nota <= 2 numa escala de 5).
   */
  limiarReprovacao?: number;
  /**
   * Desempenho (0-100) abaixo do qual um bloco de alta importância é
   * classificado como prioridade estratégica na matriz. Default 85.
   */
  limiarPrioridadeEstrategica?: number;
  /** Score mínimo aplicável (meta). Se o final ficar abaixo, gera NC. */
  metaScoreMinimo?: number | null;
}

export interface RespostaInput {
  perguntaId: string;
  valor: string | null;
  naoSeAplica?: boolean;
}

export interface ResultadoPergunta {
  perguntaId: string;
  blocoId: string;
  texto: string;
  tipo: TipoPergunta;
  criticidade: Criticidade;
  naoSeAplica: boolean;
  /** Perguntas TEXTO/FOTO ou N/A não pontuam. */
  pontua: boolean;
  notaObtida: number | null;
  notaMaxima: number;
  peso: number;
  /** Peso renormalizado dentro do bloco (0-1), 0 se não pontua. */
  pesoNormalizado: number;
  /** Contribuição para o score do bloco (0-100). */
  scoreItem: number | null;
  reprovada: boolean;
}

export interface ResultadoBloco {
  blocoId: string;
  nome: string;
  peso: number;
  /** Peso renormalizado entre os blocos que pontuam (0-1). */
  pesoNormalizado: number;
  /** Bloco sem nenhuma pergunta pontuável (excluído do score final). */
  pontua: boolean;
  score: number | null; // 0-100
}

export interface FalhaCritica {
  perguntaId: string;
  blocoId: string;
  texto: string;
}

export interface NcACriar {
  origem: OrigemNC;
  perguntaId: string | null;
  descricao: string;
  prioridade: Prioridade;
}

export interface PontoMatriz {
  blocoId: string;
  nome: string;
  /** Importância estratégica: peso normalizado do bloco em % (0-100). */
  importancia: number;
  /** Desempenho: score do bloco (0-100). */
  desempenho: number;
  prioridadeEstrategica: boolean;
}

export interface Oportunidade {
  blocoId: string;
  nome: string;
  importancia: number;
  desempenho: number;
  /** importancia/100 × (100 − desempenho) — quanto maior, mais urgente. */
  impacto: number;
}

export interface ResultadoMatriz {
  pontos: PontoMatriz[];
  prioridadesEstrategicas: PontoMatriz[];
  topOportunidades: Oportunidade[];
}

export interface ResultadoAvaliacao {
  porPergunta: ResultadoPergunta[];
  porBloco: ResultadoBloco[];
  /** Score 0-100 antes da penalidade crítica. Null se nada pontuou. */
  scoreBruto: number | null;
  /** Score 0-100 após penalidade crítica. Null se nada pontuou. */
  scoreFinal: number | null;
  faixaIgeo: FaixaIgeo | null;
  temFalhaCritica: boolean;
  falhasCriticas: FalhaCritica[];
  ncsACriar: NcACriar[];
  matriz: ResultadoMatriz;
}
