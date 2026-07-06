import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { escopoVisita } from "@/lib/rbac";
import { hashToken } from "@/lib/token-avaliacao";
import { storage } from "@/lib/storage";

/**
 * Proxy de leitura de evidências com checagem de permissão:
 * usuário interno (respeitando escopo RBAC) ou o próprio avaliador
 * (token do link via ?token=).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const evidencia = await prisma.evidencia.findUnique({
    where: { id },
    include: {
      resposta: { select: { visitaId: true } },
      acao: {
        select: { naoConformidade: { select: { visitaId: true } } },
      },
    },
  });
  if (!evidencia) {
    return NextResponse.json({ erro: "Não encontrada" }, { status: 404 });
  }

  const visitaId =
    evidencia.resposta?.visitaId ??
    evidencia.acao?.naoConformidade.visitaId ??
    null;

  let autorizado = false;

  const sessao = await obterSessao();
  if (sessao && visitaId) {
    const visita = await prisma.visita.findFirst({
      where: { id: visitaId, ...escopoVisita(sessao) },
      select: { id: true },
    });
    autorizado = !!visita;
  }

  if (!autorizado) {
    const token = req.nextUrl.searchParams.get("token");
    if (token && visitaId) {
      const tokenAcesso = await prisma.tokenAcesso.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      autorizado = tokenAcesso?.visitaId === visitaId;
    }
  }

  if (!autorizado) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  }

  const dados = await (await storage()).get(evidencia.storageKey);
  return new NextResponse(new Uint8Array(dados), {
    headers: {
      "Content-Type": evidencia.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
