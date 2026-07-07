"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { enviarEmail, rodapeEmail } from "@/lib/email";
import { baseUrlPublica, validarToken } from "@/lib/token-avaliacao";
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

/**
 * Marca/desmarca uma ETAPA (bloco) inteira como "não se aplica" ao posto —
 * ex.: o posto não presta serviço de troca de óleo — com comentário opcional
 * do avaliador justificando. Desmarcar remove o registro.
 */
export async function marcarBlocoNaoSeAplica(
  token: string,
  blocoId: string,
  naoSeAplica: boolean,
  comentario: string,
): Promise<AvaliacaoState> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  // o bloco precisa pertencer ao questionário desta visita
  const visita = await prisma.visita.findUniqueOrThrow({
    where: { id: validacao.visitaId },
    select: { questionarioId: true },
  });
  const bloco = await prisma.bloco.findUnique({
    where: { id: blocoId },
    select: { questionarioId: true },
  });
  if (!bloco || bloco.questionarioId !== visita.questionarioId) {
    return { erro: "Etapa inválida" };
  }

  if (!naoSeAplica) {
    await prisma.blocoResposta.deleteMany({
      where: { visitaId: validacao.visitaId, blocoId },
    });
    return { ok: true };
  }

  await prisma.blocoResposta.upsert({
    where: {
      visitaId_blocoId: { visitaId: validacao.visitaId, blocoId },
    },
    update: { naoSeAplica: true, comentario: comentario.trim() || null },
    create: {
      visitaId: validacao.visitaId,
      blocoId,
      naoSeAplica: true,
      comentario: comentario.trim() || null,
    },
  });
  return { ok: true };
}

export interface ObservacaoCriada {
  erro?: string;
  observacao?: { id: string; texto: string | null; fotos: string[] };
}

/**
 * Cria uma OBSERVAÇÃO no feed do item: texto e/ou fotos (que já foram
 * enviadas via /api/upload e são vinculadas aqui). A ordem de exibição é a
 * ordem de criação. Confere que tudo pertence à visita do token.
 */
export async function criarObservacao(
  token: string,
  perguntaId: string,
  texto: string,
  evidenciaIds: string[],
): Promise<ObservacaoCriada> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  const textoLimpo = texto.trim();
  if (!textoLimpo && evidenciaIds.length === 0) {
    return { erro: "Escreva um comentário ou anexe uma foto" };
  }

  const resposta = await prisma.resposta.upsert({
    where: {
      visitaId_perguntaId: { visitaId: validacao.visitaId, perguntaId },
    },
    update: {},
    create: { visitaId: validacao.visitaId, perguntaId },
  });

  const observacao = await prisma.$transaction(async (tx) => {
    const obs = await tx.observacao.create({
      data: { respostaId: resposta.id, texto: textoLimpo || null },
    });
    if (evidenciaIds.length > 0) {
      // vincula apenas fotos desta mesma visita, ainda sem observação
      await tx.evidencia.updateMany({
        where: {
          id: { in: evidenciaIds },
          observacaoId: null,
          resposta: { visitaId: validacao.visitaId },
        },
        data: { observacaoId: obs.id },
      });
    }
    return obs;
  });

  const fotos = await prisma.evidencia.findMany({
    where: { observacaoId: observacao.id },
    orderBy: { criadoEm: "asc" },
    select: { id: true },
  });
  return {
    observacao: {
      id: observacao.id,
      texto: observacao.texto,
      fotos: fotos.map((f) => f.id),
    },
  };
}

/** Apaga arquivos no storage sem falhar a operação principal. */
async function apagarArquivos(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const s = await storage();
    await Promise.allSettled(keys.map((k) => s.delete(k)));
  } catch {
    // melhor-esforço: a linha no banco é a fonte de verdade
  }
}

/**
 * Edita uma observação existente: atualiza o texto e/ou anexa fotos novas
 * (já enviadas via /api/upload) à MESMA observação.
 */
export async function editarObservacao(
  token: string,
  observacaoId: string,
  texto: string,
  novasFotos: string[],
): Promise<ObservacaoCriada> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  const obs = await prisma.observacao.findUnique({
    where: { id: observacaoId },
    select: {
      id: true,
      resposta: { select: { visitaId: true } },
      evidencias: { select: { id: true } },
    },
  });
  if (!obs || obs.resposta.visitaId !== validacao.visitaId) {
    return { erro: "Observação não encontrada" };
  }

  const textoLimpo = texto.trim();
  if (!textoLimpo && obs.evidencias.length + novasFotos.length === 0) {
    return { erro: "Escreva um comentário ou anexe uma foto" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.observacao.update({
      where: { id: observacaoId },
      data: { texto: textoLimpo || null },
    });
    if (novasFotos.length > 0) {
      await tx.evidencia.updateMany({
        where: {
          id: { in: novasFotos },
          observacaoId: null,
          resposta: { visitaId: validacao.visitaId },
        },
        data: { observacaoId },
      });
    }
  });

  const fotos = await prisma.evidencia.findMany({
    where: { observacaoId },
    orderBy: { criadoEm: "asc" },
    select: { id: true },
  });
  return {
    observacao: {
      id: observacaoId,
      texto: textoLimpo || null,
      fotos: fotos.map((f) => f.id),
    },
  };
}

export interface FotoRemovida {
  erro?: string;
  ok?: boolean;
  /** Preenchido quando a observação ficou vazia e foi removida junto. */
  observacaoRemovida?: string;
}

/**
 * Exclui UMA foto (do rascunho do composer ou de uma observação já salva).
 * Se a observação ficar sem texto e sem fotos, ela é removida também.
 */
export async function removerFotoAvaliacao(
  token: string,
  evidenciaId: string,
): Promise<FotoRemovida> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  const evidencia = await prisma.evidencia.findUnique({
    where: { id: evidenciaId },
    select: {
      id: true,
      storageKey: true,
      observacaoId: true,
      resposta: { select: { visitaId: true } },
    },
  });
  if (!evidencia || evidencia.resposta?.visitaId !== validacao.visitaId) {
    return { erro: "Foto não encontrada" };
  }

  await prisma.evidencia.delete({ where: { id: evidenciaId } });
  await apagarArquivos([evidencia.storageKey]);

  // observação órfã (sem texto e sem outras fotos) sai junto
  let observacaoRemovida: string | undefined;
  if (evidencia.observacaoId) {
    const obs = await prisma.observacao.findUnique({
      where: { id: evidencia.observacaoId },
      select: { id: true, texto: true, _count: { select: { evidencias: true } } },
    });
    if (obs && !obs.texto && obs._count.evidencias === 0) {
      await prisma.observacao.delete({ where: { id: obs.id } });
      observacaoRemovida = obs.id;
    }
  }
  return { ok: true, observacaoRemovida };
}

/**
 * Remove uma observação inteira (e suas fotos, inclusive os arquivos)
 * enquanto a avaliação ainda não foi enviada.
 */
export async function removerObservacao(
  token: string,
  observacaoId: string,
): Promise<AvaliacaoState> {
  const validacao = await validarToken(token);
  if (!validacao.ok) return { erro: "Link inválido ou expirado" };

  const obs = await prisma.observacao.findUnique({
    where: { id: observacaoId },
    select: {
      id: true,
      resposta: { select: { visitaId: true } },
      evidencias: { select: { storageKey: true } },
    },
  });
  if (!obs || obs.resposta.visitaId !== validacao.visitaId) {
    return { erro: "Observação não encontrada" };
  }
  await prisma.observacao.delete({ where: { id: observacaoId } });
  await apagarArquivos(obs.evidencias.map((e) => e.storageKey));
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
export interface GeoEnvio {
  latitude: number;
  longitude: number;
  precisaoM: number | null;
}

export async function enviarAvaliacao(
  token: string,
  respostas: RespostaRascunho[],
  geo?: GeoEnvio | null,
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
      blocosRespostas: true,
      respostas: {
        select: {
          perguntaId: true,
          _count: { select: { evidencias: true } },
        },
      },
    },
  });

  // Fotos já enviadas por pergunta (valida requisito de perguntas FOTO).
  const fotosPorPergunta = new Map(
    visita.respostas.map((r) => [r.perguntaId, r._count.evidencias]),
  );

  // Etapas marcadas como "não se aplica" pelo avaliador.
  const blocosNA = new Set(
    visita.blocosRespostas.filter((b) => b.naoSeAplica).map((b) => b.blocoId),
  );
  const perguntasEmBlocoNA = new Set(
    visita.questionario.blocos
      .filter((b) => blocosNA.has(b.id))
      .flatMap((b) => b.perguntas.map((p) => p.id)),
  );

  const porPergunta = new Map(respostas.map((r) => [r.perguntaId, r]));

  // Validação server-side das obrigatórias (etapas N/A ficam de fora).
  for (const bloco of visita.questionario.blocos) {
    if (blocosNA.has(bloco.id)) continue;
    for (const p of bloco.perguntas) {
      if (!p.obrigatoria) continue;
      const r = porPergunta.get(p.id);
      // requisito de foto é atendido por ao menos uma foto anexada
      const respondida =
        p.tipo === "FOTO"
          ? r?.naoSeAplica || (fotosPorPergunta.get(p.id) ?? 0) > 0
          : r && (r.naoSeAplica || (r.valor !== null && r.valor.trim() !== ""));
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

  const resultado = calcularScore(config, entradas, {
    blocosNaoSeAplica: [...blocosNA],
  });
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
        // pergunta dentro de etapa N/A é gravada como não se aplica
        valor: perguntasEmBlocoNA.has(r.perguntaId) ? null : r.valor,
        naoSeAplica: perguntasEmBlocoNA.has(r.perguntaId) || r.naoSeAplica,
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

    // GPS do envio (opcional — avaliador pode negar a permissão)
    const geoValido =
      geo &&
      Number.isFinite(geo.latitude) &&
      Number.isFinite(geo.longitude) &&
      Math.abs(geo.latitude) <= 90 &&
      Math.abs(geo.longitude) <= 180;

    await tx.visita.update({
      where: { id: visita.id },
      data: {
        status: "ENVIADA",
        dataEnvio: agora,
        ...(geoValido
          ? {
              envioLatitude: geo.latitude,
              envioLongitude: geo.longitude,
              envioPrecisaoM:
                geo.precisaoM === null ? null : Math.round(geo.precisaoM),
            }
          : {}),
        scoreFinal: resultado.scoreFinal,
        scoreBruto: resultado.scoreBruto,
        faixaIgeo: resultado.faixaIgeo,
        temFalhaCritica: resultado.temFalhaCritica,
        scoresPorBloco: resultado.porBloco as unknown as Prisma.InputJsonValue,
        matrizJson: resultado.matriz as unknown as Prisma.InputJsonValue,
      },
    });

    // Reenvio dentro da janela de revisão: as NCs automáticas anteriores
    // são substituídas pelas do novo resultado (as manuais permanecem).
    await tx.naoConformidade.deleteMany({
      where: {
        visitaId: visita.id,
        origem: { in: ["FALHA_CRITICA", "SCORE_ABAIXO_META"] },
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

    // O token permanece ATIVO até expirar: dentro da validade o avaliador
    // pode reabrir o link para revisar e reenviar. Ao expirar (lazy, em
    // validarToken) o acesso se encerra e o token cru é zerado.
    await tx.tokenAcesso.update({
      where: { id: validacao.tokenId },
      data: { usadoEm: agora },
    });
  });

  // Notificação por e-mail das NCs automáticas (melhor-esforço; requer
  // SMTP_* configurado — sem isso vira apenas log).
  if (resultado.ncsACriar.length > 0) {
    try {
      const [posto, interessados] = await Promise.all([
        prisma.posto.findUnique({
          where: { id: visita.postoId },
          select: { nome: true, cidade: true, uf: true },
        }),
        prisma.usuario.findMany({
          where: {
            ativo: true,
            OR: [
              { papel: { in: ["ADMIN", "CONTROLADORIA"] } },
              { papel: "GERENTE", postoId: visita.postoId },
            ],
          },
          select: { email: true },
        }),
      ]);
      const base = await baseUrlPublica();
      const lista = resultado.ncsACriar
        .map((nc) => `<li>${nc.descricao}</li>`)
        .join("");
      await enviarEmail(
        interessados.map((u) => u.email),
        `⚠ ${resultado.ncsACriar.length} Não Conformidade(s) — ${posto?.nome ?? "posto"}`,
        `<p>A avaliação de cliente oculto do posto
           <strong>${posto?.nome ?? ""} (${posto?.cidade ?? ""}/${posto?.uf ?? ""})</strong>
           abriu as seguintes não conformidades:</p>
         <ul>${lista}</ul>
         <p>Score final: <strong>${resultado.scoreFinal?.toFixed(1) ?? "—"}</strong></p>
         <p><a href="${base}/nao-conformidades" style="color:#2563eb">Tratar as não conformidades</a></p>
         ${rodapeEmail(base)}`,
      );
    } catch (e) {
      console.error("[email] falha na notificação de NC:", e);
    }
  }

  redirect("/avaliar/enviado");
}
