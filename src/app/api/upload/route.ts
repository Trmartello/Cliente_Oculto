import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { podeEditar } from "@/lib/rbac";
import { validarToken } from "@/lib/token-avaliacao";
import { storage } from "@/lib/storage";

const TAMANHO_MAXIMO = 8 * 1024 * 1024; // 8 MB
const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload de foto:
 * - Avaliador (token do link + perguntaId): evidência de resposta.
 * - Usuário interno (sessão + acaoId): foto de correção do plano de ação.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente" }, { status: 400 });
  }
  if (!TIPOS_ACEITOS.has(arquivo.type)) {
    return NextResponse.json(
      { erro: "Formato não suportado (use JPEG, PNG ou WebP)" },
      { status: 415 },
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: "Arquivo acima de 8 MB" },
      { status: 413 },
    );
  }

  const dados = Buffer.from(await arquivo.arrayBuffer());
  const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";

  const token = form.get("token") as string | null;
  const perguntaId = form.get("perguntaId") as string | null;
  const acaoId = form.get("acaoId") as string | null;

  if (token && perguntaId) {
    const validacao = await validarToken(token);
    if (!validacao.ok) {
      return NextResponse.json({ erro: "Link inválido" }, { status: 403 });
    }
    const pergunta = await prisma.pergunta.findUnique({
      where: { id: perguntaId },
    });
    if (!pergunta) {
      return NextResponse.json({ erro: "Pergunta inválida" }, { status: 400 });
    }

    const key = `visitas/${validacao.visitaId}/${randomUUID()}.${extensao}`;
    await (await storage()).put(key, dados, arquivo.type);

    const resposta = await prisma.resposta.upsert({
      where: {
        visitaId_perguntaId: {
          visitaId: validacao.visitaId,
          perguntaId,
        },
      },
      update: {},
      create: { visitaId: validacao.visitaId, perguntaId },
    });
    const evidencia = await prisma.evidencia.create({
      data: {
        respostaId: resposta.id,
        storageKey: key,
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size,
      },
    });
    return NextResponse.json({ id: evidencia.id });
  }

  if (acaoId) {
    const sessao = await obterSessao();
    if (!sessao || !podeEditar(sessao)) {
      return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
    }
    const acao = await prisma.acao.findUnique({ where: { id: acaoId } });
    if (!acao) {
      return NextResponse.json({ erro: "Ação inválida" }, { status: 400 });
    }
    const key = `acoes/${acaoId}/${randomUUID()}.${extensao}`;
    await (await storage()).put(key, dados, arquivo.type);
    const evidencia = await prisma.evidencia.create({
      data: {
        acaoId,
        storageKey: key,
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size,
      },
    });
    return NextResponse.json({ id: evidencia.id });
  }

  return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 });
}
