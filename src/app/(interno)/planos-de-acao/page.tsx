import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoPosto, podeEditar } from "@/lib/rbac";
import { sincronizarAcoesAtrasadas } from "@/lib/planos";
import { prazoVencido } from "@/lib/prazos";
import { Badge, Card, PageHeader, Tabela } from "@/components/ui";
import {
  COR_STATUS_PLANO,
  ROTULO_STATUS_PLANO,
  formatarData,
} from "@/lib/formato";
import { PlanoNovoForm } from "./planos-forms";
import { Paginacao, paginaAtual } from "@/components/paginacao";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Planos de Ação — Cliente Oculto" };

const POR_PAGINA = 50;

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ posto?: string; status?: string; pagina?: string }>;
}) {
  const sessao = await exigirSessao();
  const { posto, status, pagina: paginaBruta } = await searchParams;
  const pagina = paginaAtual(paginaBruta);

  // status "No prazo/Atrasada" se corrige na leitura (lazy, sem cron)
  await sincronizarAcoesAtrasadas();

  const where: Prisma.PlanoAcaoWhereInput = {
    posto: escopoPosto(sessao),
    ...(posto ? { postoId: posto } : {}),
    ...(status && ["ABERTO", "EM_ANDAMENTO", "CONCLUIDO"].includes(status)
      ? { status: status as Prisma.PlanoAcaoWhereInput["status"] }
      : {}),
  };

  const [planos, total, postos] = await Promise.all([
    prisma.planoAcao.findMany({
      where,
      include: {
        posto: { select: { nome: true } },
        iniciativas: {
          select: {
            status: true,
            acoes: { select: { status: true, dataLimite: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { atualizadoEm: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.planoAcao.count({ where }),
    prisma.posto.findMany({
      where: { ativo: true, ...escopoPosto(sessao) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Planos de Ação"
        descricao="Cada etapa com inconsistências vira um problema a tratar — o gestor da unidade desdobra as ações"
      />

      {podeEditar(sessao) && (
        <div className="mb-6">
          <PlanoNovoForm postos={postos} />
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3" method="get">
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
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="ABERTO">Aberto</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="CONCLUIDO">Concluído</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {planos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum plano de ação. Eles são criados automaticamente quando uma
            avaliação aponta inconsistências numa etapa — ou manualmente pelo
            botão acima.
          </p>
        </Card>
      ) : (
        <Tabela
          cabecalhos={[
            "Problema",
            "Posto",
            "Etapa",
            "Iniciativas",
            "Ações",
            "Atrasadas",
            "Status",
            "Atualizado",
          ]}
        >
          {planos.map((p) => {
            const acoes = p.iniciativas.flatMap((i) => i.acoes);
            // conta também ação com status MANUAL (ex.: Em andamento) cujo
            // prazo venceu — o automático nunca sobrescreve o manual, mas o
            // atraso precisa continuar visível
            const atrasadas = acoes.filter(
              (a) =>
                a.status === "ATRASADA" ||
                (prazoVencido(a.dataLimite) &&
                  a.status !== "CONCLUIDA" &&
                  a.status !== "CANCELADA"),
            ).length;
            return (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/planos-de-acao/${p.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {p.problema}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">{p.posto.nome}</td>
                <td className="px-4 py-3 text-sm">
                  {p.blocoNome ? (
                    <Badge cor="bg-indigo-100 text-indigo-700">
                      {p.blocoNome}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">avulso</span>
                  )}
                </td>
                <td className="px-4 py-3">{p.iniciativas.length}</td>
                <td className="px-4 py-3">{acoes.length}</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    atrasadas > 0 ? "text-red-600" : "text-slate-400"
                  }`}
                >
                  {atrasadas}
                </td>
                <td className="px-4 py-3">
                  <Badge cor={COR_STATUS_PLANO[p.status]}>
                    {ROTULO_STATUS_PLANO[p.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {formatarData(p.atualizadoEm)}
                </td>
              </tr>
            );
          })}
        </Tabela>
      )}
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        params={{ posto, status }}
      />
    </div>
  );
}
