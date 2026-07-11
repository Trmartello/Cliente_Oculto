import type { Prisma } from "@prisma/client";
import type { Sessao } from "./auth";

// Papéis que podem administrar cadastros e configurações (motor de regras).
export const PAPEIS_GESTAO = ["ADMIN", "CONTROLADORIA"] as const;

export function podeAdministrar(sessao: Sessao): boolean {
  return sessao.papel === "ADMIN" || sessao.papel === "CONTROLADORIA";
}

/** CONSULTA é somente leitura; demais papéis podem tratar NCs/ações. */
export function podeEditar(sessao: Sessao): boolean {
  return sessao.papel !== "CONSULTA";
}

/**
 * Governança de NC:
 * - CONTESTAR é do avaliado (GERENTE/GESTOR_REGIONAL): a réplica antes de a
 *   NC virar definitiva.
 * - DECIDIR a contestação é da Controladoria/Admin (o juiz).
 * - VALIDAR a correção é de um superior (Admin/Controladoria/Gestor
 *   regional), nunca CONSULTA.
 */
export function podeContestar(sessao: Sessao): boolean {
  return sessao.papel === "GERENTE" || sessao.papel === "GESTOR_REGIONAL";
}

export function podeDecidirContestacao(sessao: Sessao): boolean {
  return podeAdministrar(sessao);
}

export function podeValidarCorrecao(sessao: Sessao): boolean {
  return (
    sessao.papel === "ADMIN" ||
    sessao.papel === "CONTROLADORIA" ||
    sessao.papel === "GESTOR_REGIONAL"
  );
}

/**
 * Escopo de dados por papel, como filtro Prisma sobre Posto:
 * GERENTE vê apenas o próprio posto; GESTOR_REGIONAL apenas a sua região;
 * ADMIN/CONTROLADORIA/CONSULTA veem toda a rede.
 */
export function escopoPosto(sessao: Sessao): Prisma.PostoWhereInput {
  switch (sessao.papel) {
    case "GERENTE":
      return { id: sessao.postoId ?? "__nenhum__" };
    case "GESTOR_REGIONAL":
      return { regiao: sessao.regiao ?? "__nenhuma__" };
    default:
      return {};
  }
}

/** Mesmo escopo, aplicado a consultas de Visita. */
export function escopoVisita(sessao: Sessao): Prisma.VisitaWhereInput {
  const posto = escopoPosto(sessao);
  return Object.keys(posto).length ? { posto } : {};
}

/** Mesmo escopo, aplicado a consultas de Não Conformidade. */
export function escopoNC(sessao: Sessao): Prisma.NaoConformidadeWhereInput {
  const posto = escopoPosto(sessao);
  return Object.keys(posto).length ? { visita: { posto } } : {};
}
