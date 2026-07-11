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
  NOTA_1_5: "Estrelas (1 a 5)",
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
  EM_CONTESTACAO: "Em contestação",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const COR_STATUS_NC: Record<string, string> = {
  ABERTA: "bg-red-100 text-red-800",
  EM_CONTESTACAO: "bg-orange-100 text-orange-800",
  EM_ANDAMENTO: "bg-amber-100 text-amber-800",
  AGUARDANDO_VALIDACAO: "bg-purple-100 text-purple-800",
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
  SCORE_BLOCO_ABAIXO_META: "Etapa abaixo da meta",
  MANUAL: "Manual",
};

// ============ PLANOS DE AÇÃO ============

export const ROTULO_STATUS_ACAO_PLANO: Record<string, string> = {
  NO_PRAZO: "No prazo",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ATRASADA: "Atrasada",
  CANCELADA: "Cancelada",
  PAUSADA: "Pausada",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
};

export const COR_STATUS_ACAO_PLANO: Record<string, string> = {
  NO_PRAZO: "bg-sky-100 text-sky-800",
  EM_ANDAMENTO: "bg-blue-100 text-blue-800",
  CONCLUIDA: "bg-emerald-100 text-emerald-800",
  ATRASADA: "bg-red-100 text-red-700",
  CANCELADA: "bg-slate-200 text-slate-600",
  PAUSADA: "bg-amber-100 text-amber-800",
  AGUARDANDO_VALIDACAO: "bg-purple-100 text-purple-800",
};

export const ROTULO_STATUS_PLANO: Record<string, string> = {
  ABERTO: "Aberto",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CONCLUIDA: "Concluída",
};

export const COR_STATUS_PLANO: Record<string, string> = {
  ABERTO: "bg-red-100 text-red-700",
  ABERTA: "bg-red-100 text-red-700",
  EM_ANDAMENTO: "bg-amber-100 text-amber-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
  CONCLUIDA: "bg-emerald-100 text-emerald-800",
};

/**
 * Valores de uma resposta para EXIBIÇÃO no histórico: prioriza o snapshot
 * congelado no envio (*Enviado). Um rascunho da janela de revisão que foi
 * abandonado (autosave sem reenvio) muda só valor/naoSeAplica/comentario e
 * não pode alterar o que a visita enviada mostra. Visitas anteriores à
 * criação do snapshot (snapshotEnvioEm null) caem no valor cru (legado).
 */
export function respostaExibida<
  R extends {
    valor: string | null;
    naoSeAplica: boolean;
    comentario: string | null;
    snapshotEnvioEm: Date | null;
    valorEnviado: string | null;
    naoSeAplicaEnviado: boolean;
    comentarioEnviado: string | null;
  },
>(r: R): { valor: string | null; naoSeAplica: boolean; comentario: string | null } {
  if (r.snapshotEnvioEm) {
    return {
      valor: r.valorEnviado,
      naoSeAplica: r.naoSeAplicaEnviado,
      comentario: r.comentarioEnviado,
    };
  }
  return { valor: r.valor, naoSeAplica: r.naoSeAplica, comentario: r.comentario };
}

export const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  CONTROLADORIA: "Controladoria",
  GESTOR_REGIONAL: "Gestor Regional",
  GERENTE: "Gerente",
  CONSULTA: "Consulta",
};
