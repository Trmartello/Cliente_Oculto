"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validarToken } from "@/lib/token-avaliacao";
import { calcularScore } from "@/domain/score/engine";
import type {
  QuestionarioConfig,
  RespostaInput,
} from "@/domain/score/tipos";
import type { Prisma } from "@prisma/client";

export interface RespostaRascunho {
  perguntaId: string;
  valor: string | null;
  naoSeAplica: boolean;
  comentario: string | null;
}

export interface AvaliacaoState {
  erro?: string;
  ok?: boolean;
}

/** Autosave do rascunho — chamado a cada passo do wizard. */
export async function salvarRascunho(
  token: string,
  respostas: RespostaRascunho[],
): Promise<AvaliacaoState> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  for (const r of respostas) {
    await prisma.resposta.upsert({
      where: {
        visitaId_perguntaId: {
          visitaId: validacao.visitaId,
          perguntaId: r.perguntaId,
        },
      },
      update: {
        valor: r.valor,
        naoSeAplica: r.naoSeAplica,
        comentario: r.comentario,
      },
      create: {
        visitaId: validacao.visitaId,
        perguntaId: r.perguntaId,
        valor: r.valor,
        naoSeAplica: r.naoSeAplica,
        comentario: r.comentario,
      },
    });
  }
  return { ok: true };
}

/** Meta de score geral aplicável ao posto na data (posto > rede). */
async function metaAplicavel(postoId: string): Promise<number | null> {
  const agora = new Date();
  const vigente: Prisma.MetaWhereInput = {
    blocoNome: null,
    AND: [
      { OR: [{ vigenciaInicio: null }, { vigenciaInicio: { lte: agora } }] },
      { OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: agora } }] },
    ],
  };
  const metaPosto = await prisma.meta.findFirst({
    where: { ...vigente, postoId },
    orderBy: { criadoEm: "desc" },
  });
  if (metaPosto) return Number(metaPosto.scoreMinimo);
  const metaRede = await prisma.meta.findFirst({
    where: { ...vigente, postoId: null },
    orderBy: { criadoEm: "desc" },
  });
  return metaRede ? Number(metaRede.scoreMinimo) : null;
}

/**
 * Envio definitivo: valida obrigatórias, roda o motor de score e persiste
 * tudo em transação — snapshots por resposta e na visita, NCs automáticas
 * e token marcado como usado. O histórico fica imutável.
 */
export async function enviarAvaliacao(
  token: string,
  respostas: RespostaRascunho[],
): Promise<AvaliacaoState> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  const visita = await prisma.visita.findUniqueOrThrow({
    where: { id: validacao.visitaId },
    include: {
      questionario: {
        include: {
          blocos: {
            orderBy: { ordem: "asc" },
            include: { perguntas: { orderBy: { ordem: "asc" } } },
          },
        },
      },
    },
  });

  const porPergunta = new Map(respostas.map((r) => [r.perguntaId, r]));

  // Validação server-side das obrigatórias.
  for (const bloco of visita.questionario.blocos) {
    for (const p of bloco.perguntas) {
      if (!p.obrigatoria) continue;
      const r = porPergunta.get(p.id);
      const respondida =
        r && (r.naoSeAplica || (r.valor !== null && r.valor !== ""));
      if (!respondida) {
        return {
          erro: `Responda a pergunta obrigatória "${p.texto}" (bloco ${bloco.nome})`,
        };
      }
    }
  }

  const config: QuestionarioConfig = {
    blocos: visita.questionario.blocos.map((b) => ({
      id: b.id,
      nome: b.nome,
      peso: Number(b.peso),
      perguntas: b.perguntas.map((p) => ({
        id: p.id,
        texto: p.texto,
        tipo: p.tipo,
        peso: Number(p.peso),
        criticidade: p.criticidade,
        obrigatoria: p.obrigatoria,
        permiteNaoSeAplica: p.permiteNaoSeAplica,
        notaMaxima: Number(p.notaMaxima),
      })),
    })),
    penalidadeCriticaTipo: visita.questionario.penalidadeCriticaTipo,
    penalidadeCriticaValor: Number(visita.questionario.penalidadeCriticaValor),
    metaScoreMinimo: await metaAplicavel(visita.postoId),
  };

  const entradas: RespostaInput[] = respostas.map((r) => ({
    perguntaId: r.perguntaId,
    valor: r.valor,
    naoSeAplica: r.naoSeAplica,
  }));

  const resultado = calcularScore(config, entradas);
  const resultadoPorPergunta = new Map(
    resultado.porPergunta.map((r) => [r.perguntaId, r]),
  );
  const pesoBlocoPorId = new Map(
    resultado.porBloco.map((b) => [b.blocoId, b.peso]),
  );
  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    for (const r of respostas) {
      const calc = resultadoPorPergunta.get(r.perguntaId);
      const blocoId = calc?.blocoId;
      const snapshot = {
        valor: r.valor,
        naoSeAplica: r.naoSeAplica,
        comentario: r.comentario,
        notaObtida: calc?.notaObtida ?? null,
        notaMaximaSnapshot: calc?.notaMaxima ?? null,
        pesoPerguntaSnapshot: calc?.peso ?? null,
        pesoBlocoSnapshot: blocoId ? (pesoBlocoPorId.get(blocoId) ?? null) : null,
        criticidadeSnapshot: calc?.criticidade ?? null,
        scoreItem: calc?.scoreItem ?? null,
        reprovada: calc?.reprovada ?? false,
      };
      await tx.resposta.upsert({
        where: {
          visitaId_perguntaId: {
            visitaId: visita.id,
            perguntaId: r.perguntaId,
          },
        },
        update: snapshot,
        create: {
          visitaId: visita.id,
          perguntaId: r.perguntaId,
          ...snapshot,
        },
      });
    }

    await tx.visita.update({
      where: { id: visita.id },
      data: {
        status: "ENVIADA",
        dataEnvio: agora,
        scoreFinal: resultado.scoreFinal,
        scoreBruto: resultado.scoreBruto,
        faixaIgeo: resultado.faixaIgeo,
        temFalhaCritica: resultado.temFalhaCritica,
        scoresPorBloco: resultado.porBloco as unknown as Prisma.InputJsonValue,
        matrizJson: resultado.matriz as unknown as Prisma.InputJsonValue,
      },
    });

    for (const nc of resultado.ncsACriar) {
      await tx.naoConformidade.create({
        data: {
          visitaId: visita.id,
          perguntaId: nc.perguntaId,
          origem: nc.origem,
          descricao: nc.descricao,
          prioridade: nc.prioridade,
          prazo: new Date(agora.getTime() + 15 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await tx.tokenAcesso.update({
      where: { id: validacao.tokenId },
      data: { status: "USADO", usadoEm: agora },
    });
  });

  redirect("/avaliar/enviado");
}
