"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao } from "@/lib/auth";
import {
  escopoNC,
  podeContestar,
  podeDecidirContestacao,
  podeEditar,
  podeValidarCorrecao,
} from "@/lib/rbac";
import { dataPrazo } from "@/lib/prazos";
import type { ActionState } from "./cadastros";
import type { Sessao } from "@/lib/auth";

/**
 * Move a NC no fluxo conforme a EXECUÇÃO das ações (kanban vivo), agora com
 * GATE DE VALIDAÇÃO: todas as ações finalizadas (≥1 concluída) NÃO resolvem
 * direto — levam a NC a AGUARDANDO_VALIDACAO, onde um superior confere a
 * correção (validarCorrecao) antes de RESOLVER. Alguma ação reaberta em NC
 * já validada/aguardando volta a EM_ANDAMENTO. CANCELADA e EM_CONTESTACAO
 * (aguardando decisão humana) não são tocadas pela reconciliação automática.
 */
async function reconciliarStatusNC(ncId: string): Promise<void> {
  const nc = await prisma.naoConformidade.findUnique({
    where: { id: ncId },
    include: { acoes: { select: { status: true } } },
  });
  if (
    !nc ||
    nc.status === "CANCELADA" ||
    nc.status === "EM_CONTESTACAO" ||
    nc.acoes.length === 0
  )
    return;

  const abertas = nc.acoes.some(
    (a) => a.status === "PENDENTE" || a.status === "EM_ANDAMENTO",
  );
  const algumaConcluida = nc.acoes.some((a) => a.status === "CONCLUIDA");

  if (
    !abertas &&
    algumaConcluida &&
    nc.status !== "AGUARDANDO_VALIDACAO" &&
    nc.status !== "RESOLVIDA"
  ) {
    // execução terminou → entra na fila de validação (não resolve sozinha)
    await prisma.naoConformidade.update({
      where: { id: ncId },
      data: { status: "AGUARDANDO_VALIDACAO" },
    });
  } else if (
    abertas &&
    (nc.status === "AGUARDANDO_VALIDACAO" || nc.status === "RESOLVIDA")
  ) {
    // reabriu uma ação → volta a executar
    await prisma.naoConformidade.update({
      where: { id: ncId },
      data: { status: "EM_ANDAMENTO", dataConclusao: null },
    });
  }
}

/** Move manual do card no kanban (botões ◀ ▶), respeitando a governança. */
export async function moverNC(
  ncId: string,
  status: "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_VALIDACAO" | "RESOLVIDA",
): Promise<void> {
  const sessao = await exigirSessao();
  if (!podeEditar(sessao)) return;
  const nc = await ncNoEscopo(sessao, ncId);
  if (nc.status === status) return;
  // resolver a partir da fila de validação é ato de VALIDAÇÃO — exige o
  // papel de superior, não só "pode editar"
  if (
    status === "RESOLVIDA" &&
    nc.status === "AGUARDANDO_VALIDACAO" &&
    !podeValidarCorrecao(sessao)
  ) {
    return;
  }
  await prisma.naoConformidade.update({
    where: { id: ncId },
    data: {
      status,
      dataConclusao: status === "RESOLVIDA" ? new Date() : null,
      ...(status === "RESOLVIDA" && nc.status === "AGUARDANDO_VALIDACAO"
        ? { validadaPorId: sessao.usuarioId, validadaEm: new Date() }
        : {}),
    },
  });
  await registrarAuditoria(
    sessao,
    "nc.mover",
    "NaoConformidade",
    ncId,
    `Moveu a NC de ${nc.status} para ${status} no kanban`,
  );
  revalidatePath("/nao-conformidades");
  revalidatePath(`/nao-conformidades/${ncId}`);
}

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

  const atual = await prisma.naoConformidade.findUniqueOrThrow({
    where: { id: parsed.data.id },
    select: { dataConclusao: true },
  });
  await prisma.naoConformidade.update({
    where: { id: parsed.data.id },
    data: {
      prioridade: parsed.data.prioridade,
      status: parsed.data.status,
      responsavelId: parsed.data.responsavelId || null,
      prazo: parsed.data.prazo ? dataPrazo(parsed.data.prazo) : null,
      // editar uma NC já resolvida não reescreve a data de conclusão
      dataConclusao:
        parsed.data.status === "RESOLVIDA"
          ? (atual.dataConclusao ?? new Date())
          : null,
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
      prazo: parsed.data.prazo ? dataPrazo(parsed.data.prazo) : null,
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
  // o card do kanban acompanha a execução das ações
  await reconciliarStatusNC(acao.naoConformidadeId);
  revalidatePath(`/nao-conformidades/${acao.naoConformidadeId}`);
  revalidatePath("/nao-conformidades");
}

// ============ GOVERNANÇA DA NC ============

function revalidarNC(ncId: string) {
  revalidatePath(`/nao-conformidades/${ncId}`);
  revalidatePath("/nao-conformidades");
}

/**
 * CONTESTAÇÃO (réplica do avaliado): o gerente/gestor da unidade discorda da
 * NC e registra a justificativa. A NC entra em EM_CONTESTACAO e para de
 * transitar automaticamente até a Controladoria decidir. Só cabe enquanto a
 * NC ainda não foi resolvida/cancelada.
 */
export async function contestarNC(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  if (!podeContestar(sessao)) {
    return { erro: "Apenas o gestor da unidade pode contestar" };
  }
  const ncId = formData.get("id") as string;
  const justificativa = ((formData.get("justificativa") as string) ?? "").trim();
  if (justificativa.length < 10) {
    return { erro: "Descreva o motivo da contestação (mín. 10 caracteres)" };
  }
  const nc = await ncNoEscopo(sessao, ncId);
  if (!["ABERTA", "EM_ANDAMENTO"].includes(nc.status)) {
    return { erro: "Esta NC não está em uma fase que permita contestação" };
  }
  await prisma.naoConformidade.update({
    where: { id: ncId },
    data: {
      status: "EM_CONTESTACAO",
      contestacao: justificativa,
      contestadaPorId: sessao.usuarioId,
      contestadaEm: new Date(),
      decisaoContestacao: null,
    },
  });
  await registrarAuditoria(
    sessao,
    "nc.contestar",
    "NaoConformidade",
    ncId,
    `Contestou a NC: "${justificativa.slice(0, 120)}"`,
  );
  revalidarNC(ncId);
  return { ok: true };
}

/**
 * DECISÃO da contestação (Controladoria/Admin): aceita (procedente → a NC é
 * CANCELADA) ou rejeita (improcedente → a NC volta a ABERTA para tratamento).
 * A nota da decisão fica registrada e auditada.
 */
export async function decidirContestacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  if (!podeDecidirContestacao(sessao)) {
    return { erro: "Apenas a Controladoria decide contestações" };
  }
  const ncId = formData.get("id") as string;
  const aceitar = formData.get("aceitar") === "true";
  const nota = ((formData.get("nota") as string) ?? "").trim();
  const nc = await ncNoEscopo(sessao, ncId);
  if (nc.status !== "EM_CONTESTACAO") {
    return { erro: "Esta NC não está em contestação" };
  }
  await prisma.naoConformidade.update({
    where: { id: ncId },
    data: {
      status: aceitar ? "CANCELADA" : "ABERTA",
      dataConclusao: aceitar ? new Date() : null,
      decisaoContestacao: nota || null,
    },
  });
  await registrarAuditoria(
    sessao,
    "nc.decidir_contestacao",
    "NaoConformidade",
    ncId,
    `${aceitar ? "Acatou" : "Rejeitou"} a contestação da NC${nota ? `: "${nota.slice(0, 120)}"` : ""}`,
  );
  revalidarNC(ncId);
  return { ok: true };
}

/**
 * VALIDAÇÃO da correção (superior): confere se a NC em AGUARDANDO_VALIDACAO
 * foi de fato tratada. Aprova (→ RESOLVIDA, com validador registrado) ou
 * devolve (→ EM_ANDAMENTO, para refazer). Fecha o ciclo de qualidade.
 */
export async function validarCorrecao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  if (!podeValidarCorrecao(sessao)) {
    return { erro: "Sem permissão para validar a correção" };
  }
  const ncId = formData.get("id") as string;
  const aprovar = formData.get("aprovar") === "true";
  const nota = ((formData.get("nota") as string) ?? "").trim();
  const nc = await ncNoEscopo(sessao, ncId);
  if (nc.status !== "AGUARDANDO_VALIDACAO") {
    return { erro: "Esta NC não está aguardando validação" };
  }
  if (!aprovar && nota.length < 5) {
    return { erro: "Ao devolver, explique o que falta (mín. 5 caracteres)" };
  }
  await prisma.naoConformidade.update({
    where: { id: ncId },
    data: aprovar
      ? {
          status: "RESOLVIDA",
          dataConclusao: new Date(),
          validadaPorId: sessao.usuarioId,
          validadaEm: new Date(),
        }
      : { status: "EM_ANDAMENTO", validadaPorId: null, validadaEm: null },
  });
  await registrarAuditoria(
    sessao,
    "nc.validar",
    "NaoConformidade",
    ncId,
    `${aprovar ? "Validou a correção (Resolvida)" : "Devolveu para refazer"}${nota ? `: "${nota.slice(0, 120)}"` : ""}`,
  );
  revalidarNC(ncId);
  return { ok: true };
}
