import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarEmail, rodapeEmail } from "@/lib/email";
import { baseUrlPublica } from "@/lib/token-avaliacao";
import { corteVencimentoUtc } from "@/lib/prazos";

/**
 * Resumo diário de pendências vencidas — chamado por um cron externo
 * (Railway cron / cron-job.org) uma vez ao dia:
 *
 *   GET /api/tarefas/notificar
 *   Authorization: Bearer $CRON_SECRET   (ou ?segredo=$CRON_SECRET)
 *
 * Envia por e-mail a lista de NCs e ações corretivas com prazo vencido
 * para Controladoria/Admins e para os responsáveis diretos.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurado" },
      { status: 503 },
    );
  }
  const autorizacao =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("segredo");
  if (autorizacao !== segredo) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  // "vencido" = o dia do prazo terminou em Brasília — não cobra o
  // responsável na manhã do próprio dia do prazo
  const corte = corteVencimentoUtc();
  const [ncsVencidas, acoesVencidas, gestores] = await Promise.all([
    prisma.naoConformidade.findMany({
      where: {
        status: { in: ["ABERTA", "EM_ANDAMENTO"] },
        prazo: { lt: corte },
      },
      include: {
        visita: { include: { posto: { select: { nome: true } } } },
        responsavel: { select: { email: true, nome: true } },
      },
    }),
    prisma.acao.findMany({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        prazo: { lt: corte },
      },
      include: {
        naoConformidade: {
          include: { visita: { include: { posto: { select: { nome: true } } } } },
        },
        responsavel: { select: { email: true, nome: true } },
      },
    }),
    prisma.usuario.findMany({
      where: { ativo: true, papel: { in: ["ADMIN", "CONTROLADORIA"] } },
      select: { email: true },
    }),
  ]);

  let emailEnviado = false;
  if (ncsVencidas.length > 0 || acoesVencidas.length > 0) {
    const base = await baseUrlPublica();
    const destinatarios = [
      ...gestores.map((g) => g.email),
      ...ncsVencidas.map((n) => n.responsavel?.email ?? ""),
      ...acoesVencidas.map((a) => a.responsavel?.email ?? ""),
    ];
    const listaNcs = ncsVencidas
      .map(
        (n) =>
          `<li><strong>${n.visita.posto.nome}</strong>: ${n.descricao}` +
          (n.responsavel ? ` — responsável ${n.responsavel.nome}` : "") +
          `</li>`,
      )
      .join("");
    const listaAcoes = acoesVencidas
      .map(
        (a) =>
          `<li><strong>${a.naoConformidade.visita.posto.nome}</strong>: ${a.descricao}` +
          (a.responsavel ? ` — responsável ${a.responsavel.nome}` : "") +
          `</li>`,
      )
      .join("");
    emailEnviado = await enviarEmail(
      destinatarios,
      `⏰ Pendências vencidas: ${ncsVencidas.length} NC(s) e ${acoesVencidas.length} ação(ões)`,
      `${ncsVencidas.length ? `<p><strong>Não conformidades com prazo vencido:</strong></p><ul>${listaNcs}</ul>` : ""}
       ${acoesVencidas.length ? `<p><strong>Ações corretivas com prazo vencido:</strong></p><ul>${listaAcoes}</ul>` : ""}
       <p><a href="${base}/nao-conformidades" style="color:#2563eb">Abrir não conformidades</a></p>
       ${rodapeEmail(base)}`,
    );
  }

  return NextResponse.json({
    ncsVencidas: ncsVencidas.length,
    acoesVencidas: acoesVencidas.length,
    emailEnviado,
  });
}
