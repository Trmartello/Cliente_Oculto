import "server-only";
import { prisma } from "./prisma";
import type { Sessao } from "./auth";

/**
 * Registra uma entrada na trilha de auditoria. Nunca derruba a operação
 * principal — falha de auditoria vira log de erro.
 *
 * Convenção de `acao`: "<entidade>.<verbo>" em minúsculas
 * (ex.: "meta.criar", "pergunta.editar", "link.revogar").
 */
export async function registrarAuditoria(
  sessao: Sessao,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  resumo: string,
): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId: sessao.usuarioId,
        usuarioNome: sessao.nome,
        acao,
        entidade,
        entidadeId,
        resumo,
      },
    });
  } catch (e) {
    console.error(`[auditoria] falha ao registrar "${acao}":`, e);
  }
}
