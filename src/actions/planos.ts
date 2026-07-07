"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPapel, exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeGerirPlanoDoPosto, resolverStatusAcao } from "@/lib/planos";
import type { ActionState } from "./cadastros";
import type { Sessao } from "@/lib/auth";
import type { StatusAcaoPlano } from "@prisma/client";

async function planoNoEscopo(sessao: Sessao, planoId: string) {
  const plano = await prisma.planoAcao.findUnique({ where: { id: planoId } });
  if (!plano || !(await podeGerirPlanoDoPosto(sessao, plano.postoId))) {
    throw new Error("Plano fora do seu escopo de gestão");
  }
  return plano;
}

function revalidar(planoId: string) {
  revalidatePath("/planos-de-acao");
  revalidatePath(`/planos-de-acao/${planoId}`);
}

// ============ PLANO ============

const planoSchema = z.object({
  postoId: z.string().min(1, "Selecione o posto"),
  problema: z.string().trim().min(1, "Descreva o problema a resolver"),
  descricao: z.string().trim().optional(),
});

export async function criarPlano(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const parsed = planoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  if (!(await podeGerirPlanoDoPosto(sessao, parsed.data.postoId))) {
    return { erro: "Você não gere planos deste posto" };
  }

  const plano = await prisma.planoAcao.create({
    data: {
      postoId: parsed.data.postoId,
      problema: parsed.data.problema,
      descricao: parsed.data.descricao || null,
    },
  });
  await registrarAuditoria(
    sessao,
    "plano.criar",
    "PlanoAcao",
    plano.id,
    `Criou o plano de ação "${plano.problema}"`,
  );
  revalidar(plano.id);
  return { ok: true };
}

const planoEditarSchema = z.object({
  id: z.string().min(1),
  problema: z.string().trim().min(1, "Descreva o problema a resolver"),
  descricao: z.string().trim().optional(),
  status: z.enum(["ABERTO", "EM_ANDAMENTO", "CONCLUIDO"]),
});

export async function atualizarPlano(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const parsed = planoEditarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  await planoNoEscopo(sessao, parsed.data.id);

  await prisma.planoAcao.update({
    where: { id: parsed.data.id },
    data: {
      problema: parsed.data.problema,
      descricao: parsed.data.descricao || null,
      status: parsed.data.status,
    },
  });
  await registrarAuditoria(
    sessao,
    "plano.editar",
    "PlanoAcao",
    parsed.data.id,
    `Editou o plano "${parsed.data.problema}" (status ${parsed.data.status})`,
  );
  revalidar(parsed.data.id);
  return { ok: true };
}

export async function excluirPlano(planoId: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const plano = await prisma.planoAcao.delete({ where: { id: planoId } });
  await registrarAuditoria(
    sessao,
    "plano.excluir",
    "PlanoAcao",
    planoId,
    `Excluiu o plano "${plano.problema}" e toda a sua hierarquia`,
  );
  revalidatePath("/planos-de-acao");
  redirect("/planos-de-acao");
}

// ============ INICIATIVA ============

const iniciativaSchema = z.object({
  planoId: z.string().min(1),
  titulo: z.string().trim().min(1, "Informe o título da iniciativa"),
  descricao: z.string().trim().optional(),
});

export async function criarIniciativa(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const parsed = iniciativaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  await planoNoEscopo(sessao, parsed.data.planoId);

  const ordem = await prisma.iniciativaPlano.count({
    where: { planoId: parsed.data.planoId },
  });
  await prisma.iniciativaPlano.create({
    data: {
      planoId: parsed.data.planoId,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      ordem,
    },
  });
  await registrarAuditoria(
    sessao,
    "iniciativa.criar",
    "PlanoAcao",
    parsed.data.planoId,
    `Criou a iniciativa "${parsed.data.titulo}"`,
  );
  revalidar(parsed.data.planoId);
  return { ok: true };
}

const iniciativaEditarSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().trim().min(1, "Informe o título da iniciativa"),
  descricao: z.string().trim().optional(),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "CONCLUIDA"]),
});

export async function atualizarIniciativa(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const parsed = iniciativaEditarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  const iniciativa = await prisma.iniciativaPlano.findUniqueOrThrow({
    where: { id: parsed.data.id },
  });
  await planoNoEscopo(sessao, iniciativa.planoId);

  await prisma.iniciativaPlano.update({
    where: { id: parsed.data.id },
    data: {
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      status: parsed.data.status,
    },
  });
  await registrarAuditoria(
    sessao,
    "iniciativa.editar",
    "PlanoAcao",
    iniciativa.planoId,
    `Editou a iniciativa "${parsed.data.titulo}" (status ${parsed.data.status})`,
  );
  revalidar(iniciativa.planoId);
  return { ok: true };
}

export async function excluirIniciativa(iniciativaId: string): Promise<void> {
  const sessao = await exigirSessao();
  const iniciativa = await prisma.iniciativaPlano.findUniqueOrThrow({
    where: { id: iniciativaId },
  });
  await planoNoEscopo(sessao, iniciativa.planoId);
  await prisma.iniciativaPlano.delete({ where: { id: iniciativaId } });
  await registrarAuditoria(
    sessao,
    "iniciativa.excluir",
    "PlanoAcao",
    iniciativa.planoId,
    `Excluiu a iniciativa "${iniciativa.titulo}" e suas ações`,
  );
  revalidar(iniciativa.planoId);
}

// ============ AÇÃO ============

const STATUS_MANUAIS = [
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
  "PAUSADA",
  "AGUARDANDO_VALIDACAO",
] as const;

const acaoSchema = z.object({
  titulo: z.string().trim().min(1, "Descreva a ação"),
  descricao: z.string().trim().optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  // "AUTO" = No prazo/Atrasada, decidido pela data-limite no servidor
  status: z
    .enum(["AUTO", ...STATUS_MANUAIS])
    .default("AUTO"),
  dataLimite: z.string().optional(),
  responsavelNome: z.string().trim().optional(),
  responsavelId: z.string().optional(),
  progresso: z.coerce.number().int().min(0).max(100).default(0),
});

function montarDadosAcao(dados: z.infer<typeof acaoSchema>) {
  const dataLimite = dados.dataLimite
    ? new Date(`${dados.dataLimite}T23:59:59`)
    : null;
  // AUTO → parte de NO_PRAZO e o resolvedor decide (vira ATRASADA se venceu)
  const statusPedido: StatusAcaoPlano =
    dados.status === "AUTO" ? "NO_PRAZO" : dados.status;
  const status = resolverStatusAcao(statusPedido, dataLimite);
  return {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    prioridade: dados.prioridade,
    status,
    dataLimite,
    responsavelNome: dados.responsavelNome || null,
    responsavelId: dados.responsavelId || null,
    progresso: status === "CONCLUIDA" ? 100 : dados.progresso,
  };
}

export async function criarAcaoPlano(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const iniciativaId = formData.get("iniciativaId") as string;
  const parsed = acaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const iniciativa = await prisma.iniciativaPlano.findUniqueOrThrow({
    where: { id: iniciativaId },
  });
  await planoNoEscopo(sessao, iniciativa.planoId);

  const dados = montarDadosAcao(parsed.data);
  await prisma.acaoPlano.create({
    data: {
      iniciativaId,
      ...dados,
      concluidaEm: dados.status === "CONCLUIDA" ? new Date() : null,
    },
  });
  // desdobrar ação tira a iniciativa (e o plano) do estado "aberto"
  await prisma.iniciativaPlano.updateMany({
    where: { id: iniciativaId, status: "ABERTA" },
    data: { status: "EM_ANDAMENTO" },
  });
  await prisma.planoAcao.updateMany({
    where: { id: iniciativa.planoId, status: "ABERTO" },
    data: { status: "EM_ANDAMENTO" },
  });
  await registrarAuditoria(
    sessao,
    "acao_plano.criar",
    "PlanoAcao",
    iniciativa.planoId,
    `Desdobrou a ação "${parsed.data.titulo}" na iniciativa "${iniciativa.titulo}"`,
  );
  revalidar(iniciativa.planoId);
  return { ok: true };
}

export async function atualizarAcaoPlano(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirSessao();
  const acaoId = formData.get("id") as string;
  const parsed = acaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const acao = await prisma.acaoPlano.findUniqueOrThrow({
    where: { id: acaoId },
    include: { iniciativa: { select: { planoId: true } } },
  });
  await planoNoEscopo(sessao, acao.iniciativa.planoId);

  const dados = montarDadosAcao(parsed.data);
  await prisma.acaoPlano.update({
    where: { id: acaoId },
    data: {
      ...dados,
      concluidaEm:
        dados.status === "CONCLUIDA"
          ? (acao.concluidaEm ?? new Date())
          : null,
    },
  });
  await registrarAuditoria(
    sessao,
    "acao_plano.editar",
    "PlanoAcao",
    acao.iniciativa.planoId,
    `Atualizou a ação "${dados.titulo}" (status ${dados.status}, progresso ${dados.progresso}%)`,
  );
  revalidar(acao.iniciativa.planoId);
  return { ok: true };
}

export async function excluirAcaoPlano(acaoId: string): Promise<void> {
  const sessao = await exigirSessao();
  const acao = await prisma.acaoPlano.findUniqueOrThrow({
    where: { id: acaoId },
    include: { iniciativa: { select: { planoId: true } } },
  });
  await planoNoEscopo(sessao, acao.iniciativa.planoId);
  await prisma.acaoPlano.delete({ where: { id: acaoId } });
  await registrarAuditoria(
    sessao,
    "acao_plano.excluir",
    "PlanoAcao",
    acao.iniciativa.planoId,
    `Excluiu a ação "${acao.titulo}"`,
  );
  revalidar(acao.iniciativa.planoId);
}
