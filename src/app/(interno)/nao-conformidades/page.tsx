import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { escopoNC, escopoPosto } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import {
  COR_PRIORIDADE,
  ROTULO_ORIGEM_NC,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_NC,
  formatarData,
} from "@/lib/formato";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Não Conformidades — Cliente Oculto" };

const COLUNAS = [
  { status: "ABERTA", cor: "border-red-300 bg-red-50", titulo: "Abertas" },
  {
    status: "EM_ANDAMENTO",
    cor: "border-amber-300 bg-amber-50",
    titulo: "Em andamento",
  },
  {
    status: "RESOLVIDA",
    cor: "border-emerald-300 bg-emerald-50",
    titulo: "Resolvidas",
  },
] as const;

export default async function NcsPage({
  searchParams,
}: {
  searchParams: Promise<{ posto?: string; prioridade?: string }>;
}) {
  const sessao = await exigirSessao();
  const { posto, prioridade } = await searchParams;

  const where: Prisma.NaoConformidadeWhereInput = {
    ...escopoNC(sessao),
    ...(posto ? { visita: { postoId: posto } } : {}),
    ...(prioridade &&
    ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(prioridade)
      ? { prioridade: prioridade as Prisma.NaoConformidadeWhereInput["prioridade"] }
      : {}),
  };

  const [ncs, postos] = await Promise.all([
    prisma.naoConformidade.findMany({
      where,
      include: {
        visita: { include: { posto: { select: { nome: true } } } },
        responsavel: { select: { nome: true } },
        _count: { select: { acoes: true } },
      },
      orderBy: [{ prioridade: "desc" }, { criadoEm: "desc" }],
      take: 300,
    }),
    prisma.posto.findMany({
      where: { ativo: true, ...escopoPosto(sessao) },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Não Conformidades"
        descricao="Falhas críticas e scores abaixo da meta exigem plano de ação"
      />

      <form className="mb-6 flex flex-wrap gap-3" method="get">
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
        <select
          name="prioridade"
          defaultValue={prioridade ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todas as prioridades</option>
          {(["URGENTE", "ALTA", "MEDIA", "BAIXA"] as const).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PRIORIDADE[p]}
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

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUNAS.map((coluna) => {
          const itens = ncs.filter((nc) => nc.status === coluna.status);
          return (
            <div
              key={coluna.status}
              className={`rounded-xl border ${coluna.cor} p-3`}
            >
              <h2 className="mb-3 flex items-center justify-between font-semibold text-slate-900">
                {coluna.titulo}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">
                  {itens.length}
                </span>
              </h2>
              <div className="space-y-2">
                {itens.map((nc) => (
                  <Link
                    key={nc.id}
                    href={`/nao-conformidades/${nc.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge cor={COR_PRIORIDADE[nc.prioridade]}>
                        {ROTULO_PRIORIDADE[nc.prioridade]}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {ROTULO_ORIGEM_NC[nc.origem]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {nc.descricao}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {nc.visita.posto.nome}
                      {nc.responsavel && ` · ${nc.responsavel.nome}`}
                      {nc.prazo && ` · prazo ${formatarData(nc.prazo)}`}
                      {nc._count.acoes > 0 &&
                        ` · ${nc._count.acoes} ação(ões)`}
                    </p>
                  </Link>
                ))}
                {itens.length === 0 && (
                  <p className="px-1 py-2 text-sm text-slate-500">
                    Nenhuma {ROTULO_STATUS_NC[coluna.status].toLowerCase()}.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
