"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPapel } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Papel } from "@prisma/client";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

// ============ POSTOS ============

const postoSchema = z.object({
  codigo: z.string().trim().min(1, "Informe o código"),
  nome: z.string().trim().min(1, "Informe o nome"),
  bandeira: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  cidade: z.string().trim().min(1, "Informe a cidade"),
  uf: z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase(),
  regiao: z.string().trim().min(1, "Informe a região"),
});

export async function salvarPosto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = (formData.get("id") as string) || null;
  const parsed = postoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const data = {
    ...parsed.data,
    bandeira: parsed.data.bandeira || null,
    endereco: parsed.data.endereco || null,
  };
  let postoId = id;
  try {
    if (id) {
      await prisma.posto.update({ where: { id }, data });
    } else {
      postoId = (await prisma.posto.create({ data })).id;
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { erro: "Já existe um posto com este código" };
    }
    throw e;
  }
  await registrarAuditoria(
    sessao,
    id ? "posto.editar" : "posto.criar",
    "Posto",
    postoId,
    `${id ? "Editou" : "Criou"} o posto "${data.nome}" (${data.codigo})`,
  );
  revalidatePath("/cadastros/postos");
  return { ok: true };
}

export async function alternarAtivoPosto(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const posto = await prisma.posto.findUniqueOrThrow({ where: { id } });
  await prisma.posto.update({
    where: { id },
    data: { ativo: !posto.ativo },
  });
  await registrarAuditoria(
    sessao,
    posto.ativo ? "posto.desativar" : "posto.ativar",
    "Posto",
    id,
    `${posto.ativo ? "Desativou" : "Ativou"} o posto "${posto.nome}"`,
  );
  revalidatePath("/cadastros/postos");
}

// ============ USUÁRIOS ============

const usuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  papel: z.enum(["ADMIN", "CONTROLADORIA", "GESTOR_REGIONAL", "GERENTE", "CONSULTA"]),
  senha: z.string().optional(),
  postoId: z.string().optional(),
  regiao: z.string().trim().optional(),
});

export async function salvarUsuario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = (formData.get("id") as string) || null;
  const parsed = usuarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const { senha, ...resto } = parsed.data;
  const papel = resto.papel as Papel;
  if (!id && (!senha || senha.length < 6)) {
    return { erro: "A senha deve ter pelo menos 6 caracteres" };
  }
  if (papel === "GERENTE" && !resto.postoId) {
    return { erro: "Gerente precisa de um posto vinculado" };
  }
  if (papel === "GESTOR_REGIONAL" && !resto.regiao) {
    return { erro: "Gestor regional precisa de uma região" };
  }

  const data = {
    nome: resto.nome,
    email: resto.email,
    papel,
    postoId: papel === "GERENTE" ? resto.postoId || null : null,
    regiao: papel === "GESTOR_REGIONAL" ? resto.regiao || null : null,
    ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}),
  };

  let usuarioId = id;
  try {
    if (id) {
      await prisma.usuario.update({ where: { id }, data });
    } else {
      usuarioId = (
        await prisma.usuario.create({
          data: { ...data, senhaHash: await bcrypt.hash(senha!, 10) },
        })
      ).id;
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { erro: "Já existe um usuário com este e-mail" };
    }
    throw e;
  }
  await registrarAuditoria(
    sessao,
    id ? "usuario.editar" : "usuario.criar",
    "Usuario",
    usuarioId,
    `${id ? "Editou" : "Criou"} o usuário "${data.nome}" (${data.email}, perfil ${papel})` +
      (id && senha ? " — senha redefinida" : ""),
  );
  revalidatePath("/cadastros/usuarios");
  return { ok: true };
}

export async function alternarAtivoUsuario(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  if (sessao.usuarioId === id) return; // não desativa a si mesmo
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  await prisma.usuario.update({
    where: { id },
    data: { ativo: !usuario.ativo },
  });
  await registrarAuditoria(
    sessao,
    usuario.ativo ? "usuario.desativar" : "usuario.ativar",
    "Usuario",
    id,
    `${usuario.ativo ? "Desativou" : "Ativou"} o usuário "${usuario.nome}" (${usuario.email})`,
  );
  revalidatePath("/cadastros/usuarios");
}

// ============ METAS ============

const metaSchema = z.object({
  postoId: z.string().optional(),
  blocoNome: z.string().trim().optional(),
  scoreMinimo: z.coerce.number().min(0).max(100),
  vigenciaInicio: z.string().optional(),
  vigenciaFim: z.string().optional(),
});

export async function salvarMeta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: "Score mínimo deve estar entre 0 e 100" };

  const meta = await prisma.meta.create({
    data: {
      postoId: parsed.data.postoId || null,
      blocoNome: parsed.data.blocoNome || null,
      scoreMinimo: parsed.data.scoreMinimo,
      vigenciaInicio: parsed.data.vigenciaInicio
        ? new Date(parsed.data.vigenciaInicio)
        : null,
      vigenciaFim: parsed.data.vigenciaFim
        ? new Date(parsed.data.vigenciaFim)
        : null,
    },
  });
  await registrarAuditoria(
    sessao,
    "meta.criar",
    "Meta",
    meta.id,
    `Criou meta de score mínimo ${parsed.data.scoreMinimo}` +
      (parsed.data.blocoNome ? ` para o bloco "${parsed.data.blocoNome}"` : " (score geral)") +
      (parsed.data.postoId ? " em um posto específico" : " para a rede toda"),
  );
  revalidatePath("/cadastros/metas");
  return { ok: true };
}

export async function excluirMeta(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const meta = await prisma.meta.delete({ where: { id } });
  await registrarAuditoria(
    sessao,
    "meta.excluir",
    "Meta",
    id,
    `Excluiu meta de score mínimo ${Number(meta.scoreMinimo)}` +
      (meta.blocoNome ? ` do bloco "${meta.blocoNome}"` : " (score geral)"),
  );
  revalidatePath("/cadastros/metas");
}
