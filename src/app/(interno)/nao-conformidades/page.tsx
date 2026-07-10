import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { escopoNC, escopoPosto, podeEditar } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { moverNC } from "@/actions/ncs";
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

const LIMITE_PADRAO = 300;

export default async function NcsPage({
  searchParams,
}: {
  searchParams: Promise<{ posto?: string; prioridade?: string; limite?: string }>;
}) {
  const sessao = await exigirSessao();
  const editor = podeEditar(sessao);
  const { posto, prioridade, limite: limiteBruto } = await searchParams;
  const limite =
    Number.isInteger(Number(limiteBruto)) && Number(limiteBruto) > 0
      ? Math.min(Number(limiteBruto), 5000)
      : LIMITE_PADRAO;

  const where: Prisma.NaoConformidadeWhereInput = {
    ...escopoNC(sessao),
    ...(posto ? { visita: { postoId: posto } } : {}),
    ...(prioridade &&
    ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(prioridade)
      ? { prioridade: prioridade as Prisma.NaoConformidadeWhereInput["prioridade"] }
      : {}),
  };
  const whereKanban: Prisma.NaoConformidadeWhereInput = {
    ...where,
    status: { not: "CANCELADA" },
  };

  const [ncs, totalKanban, canceladas, postos] = await Promise.all([
    prisma.naoConformidade.findMany({
      where: whereKanban,
      include: {
        visita: { include: { posto: { select: { nome: true } } } },
        responsavel: { select: { nome: true } },
        _count: { select: { acoes: true } },
      },
      orderBy: [{ prioridade: "desc" }, { criadoEm: "desc" }],
      take: limite,
    }),
    prisma.naoConformidade.count({ where: whereKanban }),
    // canceladas não somem do sistema: ficam numa seção própria
    prisma.naoConformidade.findMany({
      where: { ...where, status: "CANCELADA" },
      include: { visita: { include: { posto: { select: { nome: true } } } } },
      orderBy: { criadoEm: "desc" },
      take: 50,
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
                  <div
                    key={nc.id}
                    className="rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow"
                  >
                    <Link
                      href={`/nao-conformidades/${nc.id}`}
                      className="block p-3"
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
                    {editor && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5">
                        {coluna.status !== "ABERTA" ? (
                          <form
                            action={async () => {
                              "use server";
                              await moverNC(
                                nc.id,
                                coluna.status === "RESOLVIDA"
                                  ? "EM_ANDAMENTO"
                                  : "ABERTA",
                              );
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded-md px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                              title="Voltar uma etapa no fluxo"
                            >
                              ◀ Voltar
                            </button>
                          </form>
                        ) : (
                          <span />
                        )}
                        {coluna.status !== "RESOLVIDA" ? (
                          <form
                            action={async () => {
                              "use server";
                              await moverNC(
                                nc.id,
                                coluna.status === "ABERTA"
                                  ? "EM_ANDAMENTO"
                                  : "RESOLVIDA",
                              );
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded-md px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              title="Avançar no fluxo"
                            >
                              {coluna.status === "ABERTA"
                                ? "Iniciar ▶"
                                : "Resolver ▶"}
                            </button>
                          </form>
                        ) : (
                          <span />
                        )}
                      </div>
                    )}
                  </div>
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

      {totalKanban > ncs.length && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <p>
            Mostrando as {ncs.length} NCs mais prioritárias de {totalKanban}.
          </p>
          <Link
            href={`?${new URLSearchParams({
              ...(posto ? { posto } : {}),
              ...(prioridade ? { prioridade } : {}),
              limite: String(limite * 2),
            })}`}
            className="font-medium text-blue-700 hover:underline"
          >
            Mostrar mais
          </Link>
        </div>
      )}

      {canceladas.length > 0 && (
        <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Canceladas ({canceladas.length}
            {canceladas.length === 50 ? "+" : ""})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {canceladas.map((nc) => (
              <li key={nc.id} className="text-sm">
                <Link
                  href={`/nao-conformidades/${nc.id}`}
                  className="text-slate-600 hover:text-blue-700 hover:underline"
                >
                  <span className="font-medium">{nc.visita.posto.nome}</span>
                  {" — "}
                  {nc.descricao}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
