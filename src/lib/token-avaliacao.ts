import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export function gerarTokenBruto(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const HOST_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)/i;

/**
 * URL base pública usada nos links do avaliador (e no QR code).
 *
 * Prioridade:
 * 1. APP_URL, quando configurada com um endereço público (não-localhost);
 * 2. cabeçalhos da própria requisição (x-forwarded-proto/host atrás de
 *    proxy — Railway, Vercel etc. — ou Host direto);
 * 3. fallback de desenvolvimento.
 *
 * Derivar da requisição elimina a causa raiz do bug "link aponta para
 * localhost em produção": APP_URL esquecida/errada deixava o link (e o QR)
 * inutilizáveis no celular do avaliador.
 */
export async function baseUrlPublica(): Promise<string> {
  const configurada = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configurada && !HOST_LOCAL.test(configurada)) return configurada;

  try {
    const h = await headers();
    const host =
      h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (/^(localhost|127\.0\.0\.1)([:/]|$)/i.test(host) ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // fora do contexto de requisição (scripts/seed) — usa o fallback
  }
  return configurada || "http://localhost:3000";
}

export async function montarLinkAvaliacao(token: string): Promise<string> {
  const base = await baseUrlPublica();
  console.log(`[link-avaliacao] link gerado com base "${base}"`);
  return `${base}/avaliar/${token}`;
}

export type ValidacaoToken =
  | { ok: true; visitaId: string; tokenId: string }
  | { ok: false; motivo: "INVALIDO" | "EXPIRADO" | "USADO" | "REVOGADO" };

/**
 * Valida o token do link do avaliador. A expiração é verificada aqui (e
 * persistida), sem necessidade de job agendado.
 */
export async function validarToken(tokenBruto: string): Promise<ValidacaoToken> {
  // Prefixo do hash identifica o token nos logs sem expor o segredo.
  const ref = hashToken(tokenBruto).slice(0, 8);
  const token = await prisma.tokenAcesso.findUnique({
    where: { tokenHash: hashToken(tokenBruto) },
    include: { visita: { select: { id: true, status: true } } },
  });
  if (!token) {
    console.warn(`[avaliacao] token ${ref}… recusado: INVALIDO (não existe)`);
    return { ok: false, motivo: "INVALIDO" };
  }
  if (token.status === "USADO" || token.visita.status === "ENVIADA") {
    console.warn(`[avaliacao] token ${ref}… recusado: USADO (visita ${token.visitaId})`);
    return { ok: false, motivo: "USADO" };
  }
  if (token.status === "REVOGADO" || token.visita.status === "CANCELADA") {
    console.warn(`[avaliacao] token ${ref}… recusado: REVOGADO (visita ${token.visitaId})`);
    return { ok: false, motivo: "REVOGADO" };
  }

  if (token.expiraEm < new Date()) {
    if (token.status !== "EXPIRADO") {
      await prisma.$transaction([
        prisma.tokenAcesso.update({
          where: { id: token.id },
          data: { status: "EXPIRADO", tokenPlano: null },
        }),
        prisma.visita.update({
          where: { id: token.visitaId },
          data: { status: "EXPIRADA" },
        }),
      ]);
    }
    console.warn(
      `[avaliacao] token ${ref}… recusado: EXPIRADO em ${token.expiraEm.toISOString()} (visita ${token.visitaId})`,
    );
    return { ok: false, motivo: "EXPIRADO" };
  }

  // Primeiro acesso: marca a visita como em andamento.
  if (!token.primeiroAcessoEm) {
    console.log(`[avaliacao] token ${ref}… primeiro acesso (visita ${token.visitaId})`);
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
