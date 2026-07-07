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
  BenchmarkChart,
  BlocosTable,
  CiclosChart,
  EvolucaoChart,
  FiltrosAtivos,
  MatrizChart,
  OportunidadePosto,
  RadarEtapas,
  RankingChart,
} from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard — Cliente Oculto" };

/** Normaliza um searchParam de seleção múltipla (repetido na URL). */
function lista(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    posto?: string | string[];
    inicio?: string;
    fim?: string;
    bloco?: string | string[];
    mes?: string | string[];
    ciclo?: string | string[];
    tipo?: string;
  }>;
}) {
  const sessao = await exigirSessao();
  const params = await searchParams;
  const postosSel = lista(params.posto);
  const blocosSel = lista(params.bloco);
  const mesesSel = lista(params.mes);
  const ciclosSel = lista(params.ciclo);
  const tipoAvaliacao =
    params.tipo === "AUDITORIA_OPERACIONAL"
      ? ("AUDITORIA_OPERACIONAL" as const)
      : ("CLIENTE_OCULTO" as const);
  const { inicio, fim } = params;

  const [postos, ciclosTodos] = await Promise.all([
    prisma.posto.findMany({
      where: { ativo: true, ...escopoPosto(sessao) },
      orderBy: { nome: "asc" },
    }),
    prisma.ciclo.findMany({ select: { id: true, nome: true } }),
  ]);

  const dados = await carregarDashboard(sessao, {
    postoIds: postosSel.length ? postosSel : undefined,
    inicio: inicio ? new Date(inicio) : undefined,
    fim: fim ? new Date(`${fim}T23:59:59`) : undefined,
    blocosNomes: blocosSel.length ? blocosSel : undefined,
    meses: mesesSel.length ? mesesSel : undefined,
    ciclosIds: ciclosSel.length ? ciclosSel : undefined,
    tipoAvaliacao,
  });

  const rotuloPeriodo =
    inicio || fim
      ? `${inicio ? dataBR(inicio) : "…"} – ${fim ? dataBR(fim) : "…"}`
      : null;

  const sufixoBlocos =
    blocosSel.length === 1
      ? `bloco ${blocosSel[0]}`
      : blocosSel.length > 1
        ? `${blocosSel.length} blocos`
        : null;

  const faixaRede =
    dados.scoreMedio !== null ? faixaIgeo(dados.scoreMedio) : null;

  return (
    <div>
      <PageHeader
        titulo="Dashboard Executivo"
        descricao="Índice Geral de Excelência Operacional (IGEO) e indicadores da rede"
      />

      {/* Abas por tipo de avaliação */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium w-fit">
        <a
          href="/dashboard"
          className={`rounded-lg px-4 py-1.5 ${
            tipoAvaliacao === "CLIENTE_OCULTO"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Cliente Oculto
        </a>
        <a
          href="/dashboard?tipo=AUDITORIA_OPERACIONAL"
          className={`rounded-lg px-4 py-1.5 ${
            tipoAvaliacao === "AUDITORIA_OPERACIONAL"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Auditoria Operacional
        </a>
      </div>

      {/* Filtros manuais (o select de posto substitui a seleção clicada) */}
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Posto</span>
          <select
            name="posto"
            defaultValue={postosSel.length === 1 ? postosSel[0] : ""}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">
              {postosSel.length > 1 ? `(${postosSel.length} selecionados)` : "Todos"}
            </option>
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
        {blocosSel.map((b) => (
          <input key={b} type="hidden" name="bloco" value={b} />
        ))}
        {mesesSel.map((m) => (
          <input key={m} type="hidden" name="mes" value={m} />
        ))}
        {ciclosSel.map((c) => (
          <input key={c} type="hidden" name="ciclo" value={c} />
        ))}
        {tipoAvaliacao !== "CLIENTE_OCULTO" && (
          <input type="hidden" name="tipo" value={tipoAvaliacao} />
        )}
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Aplicar filtros
        </button>
      </form>

      {/* Cross-filter: chips dos filtros ativos (um por valor selecionado) */}
      <FiltrosAtivos
        selecionados={{
          postos: postosSel,
          blocos: blocosSel,
          meses: mesesSel,
          ciclos: ciclosSel,
        }}
        opcoes={{
          postos: postos.map((p) => ({ valor: p.id, rotulo: p.nome })),
          blocos: dados.scorePorBloco.map((b) => b.nome),
          meses: dados.evolucaoMensal.map((m) => m.mes),
          ciclos: ciclosTodos.map((c) => ({ valor: c.id, rotulo: c.nome })),
        }}
        periodo={rotuloPeriodo}
      />

      {/* Cards de indicadores */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {sufixoBlocos ? `Score — ${sufixoBlocos}` : "Score geral (IGEO)"}
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
                mesesSelecionados={mesesSel}
              />
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold text-slate-900">
                Ranking dos postos{sufixoBlocos ? ` — ${sufixoBlocos}` : ""}
              </h2>
              <RankingChart
                dados={dados.rankingPostos.map((r) => ({
                  postoId: r.postoId,
                  nome: r.nome,
                  score: r.score,
                }))}
                postosSelecionados={postosSel}
              />
            </Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 font-semibold text-slate-900">
                Radar por etapa — máximo × aceitável × realizado
              </h2>
              <p className="mb-2 text-xs text-slate-500">
                Pontos de cada etapa no score total: o contorno cinza é o
                potencial máximo (peso da etapa), o tracejado âmbar é o
                aceitável pela meta e a área azul é o realizado. Clique no
                nome da etapa para filtrar o painel.
              </p>
              <RadarEtapas
                dados={dados.scorePorBloco}
                meta={dados.metaScore ?? 85}
                blocosSelecionados={blocosSel}
              />
            </Card>
            <Card>
              <h2 className="mb-1 font-semibold text-slate-900">
                Benchmark dos postos
              </h2>
              <p className="mb-2 text-xs text-slate-500">
                Realizado de cada posto contra a pontuação máxima possível
                (100) e o desejável (meta da rede).
              </p>
              <BenchmarkChart
                dados={dados.rankingPostos.map((r) => ({
                  postoId: r.postoId,
                  nome: r.nome,
                  score: r.score,
                }))}
                meta={dados.metaScore ?? 85}
                postosSelecionados={postosSel}
              />
            </Card>
          </div>

          {dados.comparativoCiclos.length > 0 && (
            <div className="mb-6">
              <Card>
                <h2 className="mb-1 font-semibold text-slate-900">
                  Comparativo de ciclos
                </h2>
                <p className="mb-2 text-xs text-slate-500">
                  Score médio de cada ciclo/campanha — clique para filtrar o
                  painel por ciclo.
                </p>
                <CiclosChart
                  dados={dados.comparativoCiclos}
                  meta={dados.metaScore ?? 85}
                  ciclosSelecionados={ciclosSel}
                />
              </Card>
            </div>
          )}

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 font-semibold text-slate-900">
                Matriz Importância × Desempenho
              </h2>
              <p className="mb-2 text-xs text-slate-500">
                Blocos em vermelho combinam alta importância estratégica com
                baixo desempenho — prioridades de ação.
              </p>
              <MatrizChart dados={dados.matriz} blocosSelecionados={blocosSel} />
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">
                Score por bloco e conformidade por criticidade
              </h2>
              <BlocosTable
                dados={dados.scorePorBloco}
                blocosSelecionados={blocosSel}
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
                  postosSelecionados={postosSel}
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
