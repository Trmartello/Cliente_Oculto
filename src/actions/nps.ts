"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { exigirPapel } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export interface NpsState {
  erro?: string;
  ok?: boolean;
}

/** Gera (ou reativa) o link público de NPS do posto. */
export async function gerarLinkNps(postoId: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const posto = await prisma.posto.findUniqueOrThrow({ where: { id: postoId } });

  const existente = await prisma.pesquisaNps.findFirst({ where: { postoId } });
  if (existente) {
    await prisma.pesquisaNps.update({
      where: { id: existente.id },
      data: { ativo: true },
    });
  } else {
    await prisma.pesquisaNps.create({
      data: { postoId, token: randomBytes(9).toString("base64url") },
    });
  }
  await registrarAuditoria(
    sessao,
    "nps.gerar",
    "PesquisaNps",
    postoId,
    `${existente ? "Reativou" : "Gerou"} o link de pesquisa NPS do posto "${posto.nome}"`,
  );
  revalidatePath("/nps");
}

export async function alternarAtivoNps(pesquisaId: string): Promise<void> {
  const sessao = await exigirPapel("ADMIN", "CONTROLADORIA");
  const pesquisa = await prisma.pesquisaNps.findUniqueOrThrow({
    where: { id: pesquisaId },
    include: { posto: { select: { nome: true } } },
  });
  await prisma.pesquisaNps.update({
    where: { id: pesquisaId },
    data: { ativo: !pesquisa.ativo },
  });
  await registrarAuditoria(
    sessao,
    pesquisa.ativo ? "nps.desativar" : "nps.ativar",
    "PesquisaNps",
    pesquisaId,
    `${pesquisa.ativo ? "Desativou" : "Ativou"} a pesquisa NPS do posto "${pesquisa.posto.nome}"`,
  );
  revalidatePath("/nps");
}

/** Resposta do cliente (rota pública — sem login). */
export async function responderNps(
  _prev: NpsState,
  formData: FormData,
): Promise<NpsState> {
  const token = (formData.get("token") as string) ?? "";
  const nota = Number(formData.get("nota"));
  const comentario = ((formData.get("comentario") as string) ?? "")
    .trim()
    .slice(0, 1000);

  if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
    return { erro: "Escolha uma nota de 0 a 10" };
  }
  const pesquisa = await prisma.pesquisaNps.findUnique({ where: { token } });
  if (!pesquisa || !pesquisa.ativo) {
    return { erro: "Pesquisa indisponível" };
  }
  await prisma.respostaNps.create({
    data: {
      pesquisaId: pesquisa.id,
      nota,
      comentario: comentario || null,
    },
  });
  redirect("/nps/obrigado");
}
