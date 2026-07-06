"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPapel } from "@/lib/auth";
import {
  gerarTokenBruto,
  hashToken,
  montarLinkAvaliacao,
} from "@/lib/token-avaliacao";

export interface VisitaState {
  erro?: string;
  ok?: boolean;
  /** Link completo do avaliador — exibido UMA única vez após a geração. */
  link?: string;
  visitaId?: string;
}

const visitaSchema = z.object({
  postoId: z.string().min(1, "Selecione o posto"),
  questionarioId: z.string().min(1, "Selecione o questionário"),
  avaliadorNome: z.string().trim().optional(),
  dataAgendada: z.string().min(1, "Informe a data prevista"),
  validadeDias: z.coerce.number().int().min(1).max(90),
});

export async function criarVisita(
  _prev: VisitaState,
  formData: FormData,
): Promise<VisitaState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const parsed = visitaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const questionario = await prisma.questionario.findUnique({
    where: { id: parsed.data.questionarioId },
  });
  if (!questionario || questionario.status !== "ATIVO") {
    return { erro: "Selecione um questionário ativo" };
  }

  const tokenBruto = gerarTokenBruto();
  const expiraEm = new Date(
    Date.now() + parsed.data.validadeDias * 24 * 60 * 60 * 1000,
  );

  const visita = await prisma.visita.create({
    data: {
      postoId: parsed.data.postoId,
      questionarioId: parsed.data.questionarioId,
      criadaPorId: sessao.usuarioId,
      avaliadorNome: parsed.data.avaliadorNome || null,
      dataAgendada: new Date(parsed.data.dataAgendada),
      token: {
        create: { tokenHash: hashToken(tokenBruto), expiraEm },
      },
    },
  });

  revalidatePath("/visitas");
  return {
    ok: true,
    visitaId: visita.id,
    link: montarLinkAvaliacao(tokenBruto),
  };
}

/**
 * Gera um novo link para a visita (invalida o anterior) — usado para
 * reativar link expirado/revogado ou trocar o token por segurança.
 */
export async function gerarNovoLink(
  _prev: VisitaState,
  formData: FormData,
): Promise<VisitaState> {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const visitaId = formData.get("visitaId") as string;
  const validadeDias = Math.min(
    Math.max(Number(formData.get("validadeDias") ?? 7), 1),
    90,
  );

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    include: { token: true },
  });
  if (!visita) return { erro: "Visita não encontrada" };
  if (visita.status === "ENVIADA" || visita.status === "CANCELADA") {
    return { erro: "Esta visita não aceita novo link" };
  }

  const tokenBruto = gerarTokenBruto();
  const expiraEm = new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.tokenAcesso.upsert({
      where: { visitaId },
      update: {
        tokenHash: hashToken(tokenBruto),
        expiraEm,
        status: "ATIVO",
        primeiroAcessoEm: null,
        usadoEm: null,
      },
      create: { visitaId, tokenHash: hashToken(tokenBruto), expiraEm },
    }),
    prisma.visita.update({
      where: { id: visitaId },
      data: {
        status: visita.status === "EXPIRADA" ? "AGENDADA" : visita.status,
      },
    }),
  ]);

  revalidatePath(`/visitas/${visitaId}`);
  return { ok: true, visitaId, link: montarLinkAvaliacao(tokenBruto) };
}

export async function revogarLink(visitaId: string): Promise<void> {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  await prisma.tokenAcesso.updateMany({
    where: { visitaId, status: "ATIVO" },
    data: { status: "REVOGADO" },
  });
  revalidatePath(`/visitas/${visitaId}`);
}

export async function cancelarVisita(visitaId: string): Promise<void> {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const visita = await prisma.visita.findUniqueOrThrow({
    where: { id: visitaId },
  });
  if (visita.status === "ENVIADA") return; // avaliação concluída não se cancela
  await prisma.$transaction([
    prisma.visita.update({
      where: { id: visitaId },
      data: { status: "CANCELADA" },
    }),
    prisma.tokenAcesso.updateMany({
      where: { visitaId, status: "ATIVO" },
      data: { status: "REVOGADO" },
    }),
  ]);
  revalidatePath("/visitas");
  revalidatePath(`/visitas/${visitaId}`);
}
