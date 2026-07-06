import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoPosto } from "@/lib/rbac";
import { carregarDashboard } from "@/lib/dashboard";
import { faixaIgeo, rotuloFaixa } from "@/domain/score/igeo";
import { Badge, Card, PageHeader } from "@/components/ui";
import {
  COR_FAIXA,
  ROTULO_CRITICIDADE,
  formatarScore,
} from "@/lib/formato";
import {
  BlocosTable,
  EvolucaoChart,
  FiltrosAtivos,
  MatrizChart,
  OportunidadePosto,
  RankingChart,
} from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard — Cliente Oculto" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    posto?: string;
    inicio?: string;
    fim?: string;
    bloco?: string;
  }>;
}) {
  const sessao = await exigirSessao();
  const { posto, inicio, fim, bloco } = await searchParams;

  const postos = await prisma.posto.findMany({
    where: { ativo: true, ...escopoPosto(sessao) },
    orderBy: { nome: "asc" },
  });

  const dados = await carregarDashboard(sessao, {
    postoId: posto || undefined,
    inicio: inicio ? new Date(inicio) : undefined,
    fim: fim ? new Date(`${fim}T23:59:59`) : undefined,
    blocoNome: bloco || undefined,
  });

  const postoSelecionado = posto
    ? (postos.find((p) => p.id === posto) ?? null)
    : null;
  // Período que cobre exatamente um mês => veio do clique na evolução mensal.
  const mesSelecionado =
    inicio && fim && inicio.endsWith("-01") && inicio.slice(0, 7) === fim.slice(0, 7)
      ? inicio.slice(0, 7)
      : null;

  const faixaRede =
    dados.scoreMedio !== null ? faixaIgeo(dados.scoreMedio) : null;

  return (
    <div>
      <PageHeader
        titulo="Dashboard Executivo"
        descricao="Índice Geral de Excelência Operacional (IGEO) e indicadores da rede"
      />

      {/* Filtros */}
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Posto</span>
          <select
            name="posto"
            defaultValue={posto ?? ""}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {postos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">De</span>
          <input
            name="inicio"
            type="date"
            defaultValue={inicio}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Até</span>
          <input
            name="fim"
            type="date"
            defaultValue={fim}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {bloco && <input type="hidden" name="bloco" value={bloco} />}
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Aplicar filtros
        </button>
      </form>

      {/* Cross-filter: chips dos filtros ativos */}
      <FiltrosAtivos
        postoNome={postoSelecionado?.nome ?? null}
        blocoNome={bloco ?? null}
        mesSelecionado={mesSelecionado}
      />

      {/* Cards de indicadores */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {bloco ? `Score do bloco ${bloco}` : "Score geral (IGEO)"}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {formatarScore(dados.scoreMedio)}
            </span>
            {faixaRede && (
              <Badge cor={COR_FAIXA[faixaRede]}>{rotuloFaixa(faixaRede)}</Badge>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Avaliações no período
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {dados.totalVisitas}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            NCs em aberto
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {dados.ncsAbertas}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Visitas com falha crítica
          </p>
          <p
            className={`mt-1 text-3xl font-bold ${
              dados.visitasComFalhaCritica > 0
                ? "text-red-600"
                : "text-slate-900"
            }`}
          >
            {dados.visitasComFalhaCritica}
          </p>
        </Card>
      </div>

      {dados.totalVisitas === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhuma avaliação enviada no período selecionado.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-semibold text-slate-900">
                Evolução mensal do score
              </h2>
              <EvolucaoChart
                dados={dados.evolucaoMensal}
                mesSelecionado={mesSelecionado}
              />
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold text-slate-900">
                Ranking dos postos{bloco ? ` — bloco ${bloco}` : ""}
              </h2>
              <RankingChart
                dados={dados.rankingPostos.map((r) => ({
                  postoId: r.postoId,
                  nome: r.nome,
                  score: r.score,
                }))}
                postoSelecionadoId={posto ?? null}
              />
            </Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 font-semibold text-slate-900">
                Matriz Importância × Desempenho
              </h2>
              <p className="mb-2 text-xs text-slate-500">
                Blocos em vermelho combinam alta importância estratégica com
                baixo desempenho — prioridades de ação.
              </p>
              <MatrizChart dados={dados.matriz} blocoSelecionado={bloco ?? null} />
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">
                Score por bloco e conformidade por criticidade
              </h2>
              <BlocosTable
                dados={dados.scorePorBloco}
                blocoSelecionado={bloco ?? null}
              />
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Conformidade por criticidade
                </p>
                <div className="flex flex-wrap gap-4">
                  {dados.conformidadePorCriticidade.map((c) => (
                    <div key={c.criticidade} className="text-sm">
                      <span className="text-slate-600">
                        {ROTULO_CRITICIDADE[c.criticidade]}:
                      </span>{" "}
                      <strong
                        className={
                          c.conformidade < 75
                            ? "text-red-600"
                            : c.conformidade < 90
                              ? "text-amber-600"
                              : "text-emerald-700"
                        }
                      >
                        {formatarScore(c.conformidade)}%
                      </strong>{" "}
                      <span className="text-xs text-slate-400">
                        ({c.reprovadas}/{c.total} reprovadas)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">
              Maiores oportunidades de melhoria por posto
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dados.oportunidadesPorPosto.map((p) => (
                <OportunidadePosto
                  key={p.postoId}
                  postoId={p.postoId}
                  posto={p.posto}
                  postoSelecionadoId={posto ?? null}
                >
                  <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
                    {p.oportunidades.map((o) => (
                      <li key={o.nome}>
                        {o.nome}{" "}
                        <span className="text-xs text-slate-500">
                          (score {formatarScore(o.desempenho)})
                        </span>
                      </li>
                    ))}
                  </ol>
                </OportunidadePosto>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
