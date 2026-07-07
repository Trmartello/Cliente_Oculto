import "server-only";
import { prisma } from "./prisma";
import type { Sessao } from "./auth";
import type { StatusAcaoPlano } from "@prisma/client";

/**
 * Regra central dos Planos de Ação: "No prazo" (NO_PRAZO) e "Atrasada"
 * (ATRASADA) são DERIVADOS da data-limite — o usuário nunca os escolhe.
 * Os demais status são manuais e nunca são sobrescritos pelo automático.
 */

/**
 * Reconciliação em massa, lazy (sem cron): chamada no início das leituras
 * das páginas de planos — o dado se corrige quando alguém lê.
 */
export async function sincronizarAcoesAtrasadas(): Promise<void> {
  const agora = new Date();
  // vencidas → ATRASADA
  await prisma.acaoPlano.updateMany({
    where: {
      status: { in: ["NO_PRAZO", "EM_ANDAMENTO"] },
      dataLimite: { lt: agora },
    },
    data: { status: "ATRASADA" },
  });
  // ATRASADA reagendada (data futura) ou sem data → volta a NO_PRAZO
  await prisma.acaoPlano.updateMany({
    where: {
      status: "ATRASADA",
      OR: [{ dataLimite: { gte: agora } }, { dataLimite: null }],
    },
    data: { status: "NO_PRAZO" },
  });
}

/**
 * Resolução pontual em create/update: o payload pode trazer status e/ou
 * nova data — o servidor decide o estado final.
 */
export function resolverStatusAcao(
  status: StatusAcaoPlano,
  dataLimite: Date | null | undefined,
): StatusAcaoPlano {
  const vencida = !!dataLimite && dataLimite < new Date();
  if ((status === "NO_PRAZO" || status === "EM_ANDAMENTO") && vencida) {
    return "ATRASADA";
  }
  if (status === "ATRASADA" && !vencida) return "NO_PRAZO";
  return status;
}

/**
 * Gestão de plano por escopo: quem edita (papel != CONSULTA) só gere planos
 * de postos do seu alcance — GERENTE o próprio posto, GESTOR_REGIONAL a
 * região, ADMIN/CONTROLADORIA tudo.
 */
export async function podeGerirPlanoDoPosto(
  sessao: Sessao,
  postoId: string,
): Promise<boolean> {
  if (sessao.papel === "CONSULTA") return false;
  if (sessao.papel === "ADMIN" || sessao.papel === "CONTROLADORIA") return true;
  if (sessao.papel === "GERENTE") return sessao.postoId === postoId;
  if (sessao.papel === "GESTOR_REGIONAL") {
    const posto = await prisma.posto.findUnique({
      where: { id: postoId },
      select: { regiao: true },
    });
    return posto?.regiao === sessao.regiao;
  }
  return false;
}
