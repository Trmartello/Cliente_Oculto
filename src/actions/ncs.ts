"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao } from "@/lib/auth";
import { escopoNC, podeEditar } from "@/lib/rbac";
import type { ActionState } from "./cadastros";
import type { Sessao } from "@/lib/auth";

async function ncNoEscopo(sessao: Sessao, ncId: string) {
  const nc = await prisma.naoConformidade.findFirst({
    where: { id: ncId, ...escopoNC(sessao) },
  });
  if (!nc) throw new Error("Não conformidade fora do seu escopo");
  return nc;
}

const ncSchema = z.object({
  id: z.string().min(1),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"]),
  responsavelId: z.string().optional(),
  prazo: z.string().optional(),
});

export async function atualizarNC(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  if (!podeEditar(sessao)) return { erro: "Perfil somente leitura" };
  const parsed = ncSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: "Dados inválidos" };
  await ncNoEscopo(sessao, parsed.data.id);

  await prisma.naoConformidade.update({
    where: { id: parsed.data.id },
    data: {
      prioridade: parsed.data.prioridade,
      status: parsed.data.status,
      responsavelId: parsed.data.responsavelId || null,
      prazo: parsed.data.prazo ? new Date(parsed.data.prazo) : null,
      dataConclusao:
        parsed.data.status === "RESOLVIDA" ? new Date() : null,
    },
  });
  await registrarAuditoria(
    sessao,
    "nc.editar",
    "NaoConformidade",
    parsed.data.id,
    `Atualizou o tratamento da NC (status ${parsed.data.status}, prioridade ${parsed.data.prioridade})`,
  );
  revalidatePath(`/nao-conformidades/${parsed.data.id}`);
  revalidatePath("/nao-conformidades");
  return { ok: true };
}

const acaoSchema = z.object({
  naoConformidadeId: z.string().min(1),
  descricao: z.string().trim().min(1, "Descreva a ação corretiva"),
  responsavelId: z.string().optional(),
  prazo: z.string().optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
});

export async function criarAcao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  if (!podeEditar(sessao)) return { erro: "Perfil somente leitura" };
  const parsed = acaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  await ncNoEscopo(sessao, parsed.data.naoConformidadeId);

  await prisma.acao.create({
    data: {
      naoConformidadeId: parsed.data.naoConformidadeId,
      descricao: parsed.data.descricao,
      responsavelId: parsed.data.responsavelId || null,
      prazo: parsed.data.prazo ? new Date(parsed.data.prazo) : null,
      prioridade: parsed.data.prioridade,
    },
  });

  // NC aberta com plano de ação passa a "em andamento".
  await prisma.naoConformidade.updateMany({
    where: { id: parsed.data.naoConformidadeId, status: "ABERTA" },
    data: { status: "EM_ANDAMENTO" },
  });

  await registrarAuditoria(
    sessao,
    "acao.criar",
    "NaoConformidade",
    parsed.data.naoConformidadeId,
    `Adicionou ação corretiva: "${parsed.data.descricao.slice(0, 80)}"`,
  );
  revalidatePath(`/nao-conformidades/${parsed.data.naoConformidadeId}`);
  return { ok: true };
}

export async function atualizarStatusAcao(
  acaoId: string,
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA",
): Promise<void> {
  const sessao = await exigirSessao();
  if (!podeEditar(sessao)) return;
  const acao = await prisma.acao.findUniqueOrThrow({
    where: { id: acaoId },
  });
  await ncNoEscopo(sessao, acao.naoConformidadeId);

  await prisma.acao.update({
    where: { id: acaoId },
    data: {
      status,
      dataConclusao: status === "CONCLUIDA" ? new Date() : null,
    },
  });
  revalidatePath(`/nao-conformidades/${acao.naoConformidadeId}`);
}
