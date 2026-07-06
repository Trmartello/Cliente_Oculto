import type { FaixaIgeo } from "@prisma/client";

export function formatarData(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatarDataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

export function formatarScore(s: unknown): string {
  if (s === null || s === undefined) return "—";
  return Number(s).toFixed(1);
}

export const ROTULO_FAIXA: Record<FaixaIgeo, string> = {
  EXCELENCIA: "Excelência",
  MUITO_BOM: "Muito Bom",
  BOM: "Bom",
  REGULAR: "Regular",
  CRITICO: "Crítico",
};

export const COR_FAIXA: Record<FaixaIgeo, string> = {
  EXCELENCIA: "bg-emerald-100 text-emerald-800",
  MUITO_BOM: "bg-green-100 text-green-800",
  BOM: "bg-lime-100 text-lime-800",
  REGULAR: "bg-amber-100 text-amber-800",
  CRITICO: "bg-red-100 text-red-800",
};

export const ROTULO_CRITICIDADE: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const COR_CRITICIDADE: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-sky-100 text-sky-800",
  ALTA: "bg-amber-100 text-amber-800",
  CRITICA: "bg-red-100 text-red-800",
};

export const ROTULO_TIPO_PERGUNTA: Record<string, string> = {
  SIM_NAO: "Sim / Não",
  NOTA_1_5: "Nota 1 a 5",
  NOTA_1_10: "Nota 1 a 10",
  ATENDE_NAO_ATENDE: "Atende / Não Atende",
  TEXTO: "Texto",
  FOTO: "Foto",
};

export const ROTULO_STATUS_VISITA: Record<string, string> = {
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  ENVIADA: "Enviada",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

export const COR_STATUS_VISITA: Record<string, string> = {
  AGENDADA: "bg-sky-100 text-sky-800",
  EM_ANDAMENTO: "bg-amber-100 text-amber-800",
  ENVIADA: "bg-emerald-100 text-emerald-800",
  EXPIRADA: "bg-slate-100 text-slate-600",
  CANCELADA: "bg-slate-100 text-slate-600",
};

export const ROTULO_STATUS_NC: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const COR_STATUS_NC: Record<string, string> = {
  ABERTA: "bg-red-100 text-red-800",
  EM_ANDAMENTO: "bg-amber-100 text-amber-800",
  RESOLVIDA: "bg-emerald-100 text-emerald-800",
  CANCELADA: "bg-slate-100 text-slate-600",
};

export const ROTULO_PRIORIDADE: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const COR_PRIORIDADE: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-sky-100 text-sky-800",
  ALTA: "bg-amber-100 text-amber-800",
  URGENTE: "bg-red-100 text-red-800",
};

export const ROTULO_ORIGEM_NC: Record<string, string> = {
  FALHA_CRITICA: "Falha crítica",
  SCORE_ABAIXO_META: "Score abaixo da meta",
  MANUAL: "Manual",
};
