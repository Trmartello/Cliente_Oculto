"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPapel } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import type { ActionState } from "./cadastros";

/**
 * Questionário com visitas enviadas é imutável (o histórico depende dos
 * snapshots, mas a configuração vigente também não deve mudar sob os pés
 * de links ativos). Alterações exigem nova versão.
 */
async function exigirEditavel(questionarioId: string): Promise<void> {
  const enviadas = await prisma.visita.count({
    where: { questionarioId, status: "ENVIADA" },
  });
  if (enviadas > 0) {
    throw new Error(
      "Questionário com avaliações enviadas não pode ser alterado — gere uma nova versão.",
    );
  }
}

// ============ QUESTIONÁRIO ============

const questionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  descricao: z.string().trim().optional(),
  penalidadeCriticaTipo: z.enum(["NENHUMA", "PERCENTUAL", "TETO"]),
  penalidadeCriticaValor: z.coerce.number().min(0).max(100),
  tipo: z
    .enum(["CLIENTE_OCULTO", "AUDITORIA_OPERACIONAL"])
    .default("CLIENTE_OCULTO"),
});

export async function criarQuestionario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const parsed = questionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const q = await prisma.questionario.create({
    data: { ...parsed.data, descricao: parsed.data.descricao || null },
  });
  await registrarAuditoria(
    sessao,
    "questionario.criar",
    "Questionario",
    q.id,
    `Criou o questionário "${q.nome}"`,
  );
  redirect(`/cadastros/questionarios/${q.id}`);
}

export async function salvarConfigQuestionario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = formData.get("id") as string;
  await exigirEditavel(id);
  const parsed = questionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  await prisma.questionario.update({
    where: { id },
    data: { ...parsed.data, descricao: parsed.data.descricao || null },
  });
  await registrarAuditoria(
    sessao,
    "questionario.editar",
    "Questionario",
    id,
    `Alterou configurações do questionário "${parsed.data.nome}" ` +
      `(penalidade ${parsed.data.penalidadeCriticaTipo} ${parsed.data.penalidadeCriticaValor})`,
  );
  revalidatePath(`/cadastros/questionarios/${id}`);
  return { ok: true };
}

export async function alterarStatusQuestionario(
  id: string,
  status: "RASCUNHO" | "ATIVO" | "ARQUIVADO",
): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  if (status === "ATIVO") {
    const blocos = await prisma.bloco.count({
      where: { questionarioId: id, perguntas: { some: {} } },
    });
    if (blocos === 0) return; // não ativa questionário vazio
  }
  const q = await prisma.questionario.update({ where: { id }, data: { status } });
  await registrarAuditoria(
    sessao,
    "questionario.status",
    "Questionario",
    id,
    `Alterou o status de "${q.nome}" (v${q.versao}) para ${status}`,
  );
  revalidatePath("/cadastros/questionarios");
  revalidatePath(`/cadastros/questionarios/${id}`);
}

/** Duplica o questionário como nova versão editável (RASCUNHO). */
export async function gerarNovaVersao(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const original = await prisma.questionario.findUniqueOrThrow({
    where: { id },
    include: { blocos: { include: { perguntas: true }, orderBy: { ordem: "asc" } } },
  });

  const maiorVersao = await prisma.questionario.aggregate({
    where: { nome: original.nome },
    _max: { versao: true },
  });

  const nova = await prisma.questionario.create({
    data: {
      nome: original.nome,
      descricao: original.descricao,
      versao: (maiorVersao._max.versao ?? original.versao) + 1,
      status: "RASCUNHO",
      penalidadeCriticaTipo: original.penalidadeCriticaTipo,
      penalidadeCriticaValor: original.penalidadeCriticaValor,
      tipo: original.tipo,
      blocos: {
        create: original.blocos.map((b) => ({
          nome: b.nome,
          peso: b.peso,
          ordem: b.ordem,
          perguntas: {
            create: b.perguntas.map((p) => ({
              texto: p.texto,
              tipo: p.tipo,
              peso: p.peso,
              criticidade: p.criticidade,
              obrigatoria: p.obrigatoria,
              permiteNaoSeAplica: p.permiteNaoSeAplica,
              notaMaxima: p.notaMaxima,
              ordem: p.ordem,
            })),
          },
        })),
      },
    },
  });
  await registrarAuditoria(
    sessao,
    "questionario.nova_versao",
    "Questionario",
    nova.id,
    `Gerou a versão v${nova.versao} do questionário "${nova.nome}"`,
  );
  redirect(`/cadastros/questionarios/${nova.id}`);
}

// ============ BLOCOS ============

const blocoSchema = z.object({
  questionarioId: z.string().min(1),
  nome: z.string().trim().min(1, "Informe o nome do bloco"),
  peso: z.coerce.number().gt(0, "Peso deve ser maior que zero").max(100),
});

export async function salvarBloco(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = (formData.get("id") as string) || null;
  const parsed = blocoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  await exigirEditavel(parsed.data.questionarioId);

  if (id) {
    await prisma.bloco.update({
      where: { id },
      data: { nome: parsed.data.nome, peso: parsed.data.peso },
    });
  } else {
    const ultimo = await prisma.bloco.aggregate({
      where: { questionarioId: parsed.data.questionarioId },
      _max: { ordem: true },
    });
    await prisma.bloco.create({
      data: {
        questionarioId: parsed.data.questionarioId,
        nome: parsed.data.nome,
        peso: parsed.data.peso,
        ordem: (ultimo._max.ordem ?? -1) + 1,
      },
    });
  }
  await registrarAuditoria(
    sessao,
    id ? "bloco.editar" : "bloco.criar",
    "Bloco",
    id,
    `${id ? "Editou" : "Criou"} o bloco "${parsed.data.nome}" (peso ${parsed.data.peso}%)`,
  );
  revalidatePath(`/cadastros/questionarios/${parsed.data.questionarioId}`);
  return { ok: true };
}

export async function excluirBloco(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const bloco = await prisma.bloco.findUniqueOrThrow({ where: { id } });
  await exigirEditavel(bloco.questionarioId);
  await prisma.bloco.delete({ where: { id } });
  await registrarAuditoria(
    sessao,
    "bloco.excluir",
    "Bloco",
    id,
    `Excluiu o bloco "${bloco.nome}" e suas perguntas`,
  );
  revalidatePath(`/cadastros/questionarios/${bloco.questionarioId}`);
}

// ============ PERGUNTAS ============

const NOTA_MAXIMA_POR_TIPO: Record<string, number> = {
  SIM_NAO: 1,
  ATENDE_NAO_ATENDE: 1,
  NOTA_1_5: 5,
  NOTA_1_10: 10,
  TEXTO: 0,
  FOTO: 0,
};

const perguntaSchema = z.object({
  blocoId: z.string().min(1),
  texto: z.string().trim().min(1, "Informe o texto da pergunta"),
  tipo: z.enum(["SIM_NAO", "NOTA_1_5", "NOTA_1_10", "ATENDE_NAO_ATENDE", "TEXTO", "FOTO"]),
  peso: z.coerce.number().min(0).max(100),
  criticidade: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
});

export async function salvarPergunta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const id = (formData.get("id") as string) || null;
  const parsed = perguntaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const bloco = await prisma.bloco.findUniqueOrThrow({
    where: { id: parsed.data.blocoId },
  });
  await exigirEditavel(bloco.questionarioId);

  const pontuavel = !["TEXTO", "FOTO"].includes(parsed.data.tipo);
  if (pontuavel && parsed.data.peso <= 0) {
    return { erro: "Pergunta pontuável precisa de peso maior que zero" };
  }

  const data = {
    blocoId: parsed.data.blocoId,
    texto: parsed.data.texto,
    tipo: parsed.data.tipo,
    peso: parsed.data.peso,
    criticidade: parsed.data.criticidade,
    obrigatoria: formData.get("obrigatoria") === "on",
    permiteNaoSeAplica: formData.get("permiteNaoSeAplica") === "on",
    notaMaxima: NOTA_MAXIMA_POR_TIPO[parsed.data.tipo],
  };

  if (id) {
    await prisma.pergunta.update({ where: { id }, data });
  } else {
    const ultimo = await prisma.pergunta.aggregate({
      where: { blocoId: parsed.data.blocoId },
      _max: { ordem: true },
    });
    await prisma.pergunta.create({
      data: { ...data, ordem: (ultimo._max.ordem ?? -1) + 1 },
    });
  }
  await registrarAuditoria(
    sessao,
    id ? "pergunta.editar" : "pergunta.criar",
    "Pergunta",
    id,
    `${id ? "Editou" : "Criou"} a pergunta "${data.texto.slice(0, 80)}" ` +
      `(bloco "${bloco.nome}", peso ${data.peso}, criticidade ${data.criticidade}` +
      `${data.obrigatoria ? ", requisito" : ""})`,
  );
  revalidatePath(`/cadastros/questionarios/${bloco.questionarioId}`);
  return { ok: true };
}

export async function excluirPergunta(id: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const pergunta = await prisma.pergunta.findUniqueOrThrow({
    where: { id },
    include: { bloco: true },
  });
  await exigirEditavel(pergunta.bloco.questionarioId);
  await prisma.pergunta.delete({ where: { id } });
  await registrarAuditoria(
    sessao,
    "pergunta.excluir",
    "Pergunta",
    id,
    `Excluiu a pergunta "${pergunta.texto.slice(0, 80)}" do bloco "${pergunta.bloco.nome}"`,
  );
  revalidatePath(`/cadastros/questionarios/${pergunta.bloco.questionarioId}`);
}
