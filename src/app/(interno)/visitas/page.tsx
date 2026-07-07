import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { podeAdministrar, escopoVisita } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge, PageHeader, Tabela } from "@/components/ui";
import {
  COR_FAIXA,
  COR_STATUS_VISITA,
  ROTULO_FAIXA,
  ROTULO_STATUS_VISITA,
  formatarData,
  formatarScore,
} from "@/lib/formato";
import { baseUrlPublica } from "@/lib/token-avaliacao";
import { VisitaNovaForm } from "./visita-nova-form";
import { CompartilharLink } from "./compartilhar-link";
import { mensagemConvite } from "./convite";
import type { Prisma, StatusVisita } from "@prisma/client";

export const metadata = { title: "Visitas — Cliente Oculto" };

const STATUS_VALIDOS = [
  "AGENDADA",
  "EM_ANDAMENTO",
  "ENVIADA",
  "EXPIRADA",
  "CANCELADA",
] as const;

export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; posto?: string }>;
}) {
  const sessao = await exigirSessao();
  const { status, posto } = await searchParams;
  const admin = podeAdministrar(sessao);

  const where: Prisma.VisitaWhereInput = { ...escopoVisita(sessao) };
  if (status && (STATUS_VALIDOS as readonly string[]).includes(status)) {
    where.status = status as StatusVisita;
  }
  if (posto) where.postoId = posto;

  const [visitas, postos, questionarios, avaliadores] = await Promise.all([
    prisma.visita.findMany({
      where,
      orderBy: { dataAgendada: "desc" },
      take: 200,
      include: { posto: true, token: true },
    }),
    prisma.posto.findMany({
      where: { ativo: true, ...(admin ? {} : {}) },
      orderBy: { nome: "asc" },
    }),
    prisma.questionario.findMany({
      where: { status: "ATIVO" },
      orderBy: [{ nome: "asc" }, { versao: "desc" }],
    }),
    prisma.avaliador.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  // Base pública para reconstruir o link dos tokens ativos (reenvio).
  const base = await baseUrlPublica();

  return (
    <div>
      <PageHeader
        titulo="Visitas"
        descricao="Avaliações agendadas e enviadas — o avaliador acessa pelo link no celular"
      />

      {admin && (
        <div className="mb-6">
          <VisitaNovaForm
            postos={postos.map((p) => ({ id: p.id, nome: p.nome }))}
            questionarios={questionarios.map((q) => ({
              id: q.id,
              nome: `${q.nome} (v${q.versao})`,
            }))}
            avaliadores={avaliadores}
          />
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_VALIDOS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_VISITA[s]}
            </option>
          ))}
        </select>
        <select
          name="posto"
          defaultValue={posto ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os postos</option>
          {postos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      <Tabela
        cabecalhos={[
          "Posto",
          "Data prevista",
          "Avaliador",
          "Status",
          "Score",
          "IGEO",
          "Link",
        ]}
      >
        {visitas.map((v) => (
          <tr key={v.id}>
            <td className="px-4 py-3 font-medium">
              <Link
                href={`/visitas/${v.id}`}
                className="text-blue-700 hover:underline"
              >
                {v.posto.nome}
              </Link>
            </td>
            <td className="px-4 py-3">{formatarData(v.dataAgendada)}</td>
            <td className="px-4 py-3">{v.avaliadorNome ?? "—"}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Badge cor={COR_STATUS_VISITA[v.status]}>
                  {ROTULO_STATUS_VISITA[v.status]}
                </Badge>
                {v.temFalhaCritica && (
                  <Badge cor="bg-red-600 text-white">Falha crítica</Badge>
                )}
              </div>
            </td>
            <td className="px-4 py-3 font-semibold">
              {formatarScore(v.scoreFinal)}
            </td>
            <td className="px-4 py-3">
              {v.faixaIgeo ? (
                <Badge cor={COR_FAIXA[v.faixaIgeo]}>
                  {ROTULO_FAIXA[v.faixaIgeo]}
                </Badge>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">
              {v.token && v.token.status === "ATIVO" ? (
                <div className="space-y-1.5">
                  <p>válido até {formatarData(v.token.expiraEm)}</p>
                  {admin && v.token.tokenPlano && (
                    <CompartilharLink
                      variante="compacto"
                      link={`${base}/avaliar/${v.token.tokenPlano}`}
                      mensagem={mensagemConvite(
                        v.posto.nome,
                        `${base}/avaliar/${v.token.tokenPlano}`,
                      )}
                    />
                  )}
                </div>
              ) : v.token ? (
                v.token.status.toLowerCase()
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}
