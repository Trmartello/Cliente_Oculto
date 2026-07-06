"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPapel } from "@/lib/auth";
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
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = (formData.get("id") as string) || null;
  const parsed = postoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const data = {
    ...parsed.data,
    bandeira: parsed.data.bandeira || null,
    endereco: parsed.data.endereco || null,
  };
  try {
    if (id) {
      await prisma.posto.update({ where: { id }, data });
    } else {
      await prisma.posto.create({ data });
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { erro: "Já existe um posto com este código" };
    }
    throw e;
  }
  revalidatePath("/cadastros/postos");
  return { ok: true };
}

export async function alternarAtivoPosto(id: string): Promise<void> {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const posto = await prisma.posto.findUniqueOrThrow({ where: { id } });
  await prisma.posto.update({
    where: { id },
    data: { ativo: !posto.ativo },
  });
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
  await exigirPapel("ADMIN", "CONTROLADORIA");
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

  try {
    if (id) {
      await prisma.usuario.update({ where: { id }, data });
    } else {
      await prisma.usuario.create({
        data: { ...data, senhaHash: await bcrypt.hash(senha!, 10) },
      });
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { erro: "Já existe um usuário com este e-mail" };
    }
    throw e;
  }
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
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: "Score mínimo deve estar entre 0 e 100" };

  await prisma.meta.create({
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
  revalidatePath("/cadastros/metas");
  return { ok: true };
}

export async function excluirMeta(id: string): Promise<void> {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  await prisma.meta.delete({ where: { id } });
  revalidatePath("/cadastros/metas");
}
