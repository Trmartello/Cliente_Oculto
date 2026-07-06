import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

export function gerarTokenBruto(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function montarLinkAvaliacao(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/avaliar/${token}`;
}

export type ValidacaoToken =
  | { ok: true; visitaId: string; tokenId: string }
  | { ok: false; motivo: "INVALIDO" | "EXPIRADO" | "USADO" | "REVOGADO" };

/**
 * Valida o token do link do avaliador. A expiração é verificada aqui (e
 * persistida), sem necessidade de job agendado.
 */
export async function validarToken(tokenBruto: string): Promise<ValidacaoToken> {
  const token = await prisma.tokenAcesso.findUnique({
    where: { tokenHash: hashToken(tokenBruto) },
    include: { visita: { select: { id: true, status: true } } },
  });
  if (!token) return { ok: false, motivo: "INVALIDO" };
  if (token.status === "USADO" || token.visita.status === "ENVIADA")
    return { ok: false, motivo: "USADO" };
  if (token.status === "REVOGADO" || token.visita.status === "CANCELADA")
    return { ok: false, motivo: "REVOGADO" };

  if (token.expiraEm < new Date()) {
    if (token.status !== "EXPIRADO") {
      await prisma.$transaction([
        prisma.tokenAcesso.update({
          where: { id: token.id },
          data: { status: "EXPIRADO" },
        }),
        prisma.visita.update({
          where: { id: token.visitaId },
          data: { status: "EXPIRADA" },
        }),
      ]);
    }
    return { ok: false, motivo: "EXPIRADO" };
  }

  // Primeiro acesso: marca a visita como em andamento.
  if (!token.primeiroAcessoEm) {
    await prisma.$transaction([
      prisma.tokenAcesso.update({
        where: { id: token.id },
        data: { primeiroAcessoEm: new Date() },
      }),
      prisma.visita.updateMany({
        where: { id: token.visitaId, status: "AGENDADA" },
        data: { status: "EM_ANDAMENTO", dataInicio: new Date() },
      }),
    ]);
  }

  return { ok: true, visitaId: token.visitaId, tokenId: token.id };
}
