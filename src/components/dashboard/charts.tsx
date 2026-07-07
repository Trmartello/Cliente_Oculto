"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Paleta validada (validate_palette.js): azul primário + status IGEO.
const AZUL = "#2563eb";
const GRID = "#e2e8f0";
const TEXTO_MUTED = "#64748b";

function corPorScore(score: number): string {
  if (score >= 95) return "#059669"; // Excelência
  if (score >= 85) return "#10b981"; // Muito Bom / Bom
  if (score >= 75) return "#d97706"; // Regular
  return "#dc2626"; // Crítico
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${ano.slice(2)}`;
}

// ============ CROSS-FILTER (estilo BI, seleção múltipla) ============
// Cada clique ADICIONA o item à seleção daquela dimensão (clicar de novo
// remove). As seleções vivem na URL como parâmetros repetidos
// (?posto=a&posto=b&bloco=X&mes=2026-06): OR dentro da mesma dimensão,
// AND entre dimensões — e o estado do painel segue compartilhável.

function useFiltrosBI() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();

  function aplicar(mudancas: Record<string, string | string[] | null>) {
    const qs = new URLSearchParams(sp.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      qs.delete(chave);
      if (valor === null) continue;
      for (const v of Array.isArray(valor) ? valor : [valor]) {
        if (v) qs.append(chave, v);
      }
    }
    startTransition(() => {
      router.replace(`?${qs.toString()}`, { scroll: false });
    });
  }

  /** Adiciona/remove um valor da seleção múltipla do parâmetro. */
  function toggle(param: string, valor: string) {
    const atuais = sp.getAll(param);
    const novos = atuais.includes(valor)
      ? atuais.filter((v) => v !== valor)
      : [...atuais, valor];
    aplicar({ [param]: novos.length ? novos : null });
  }

  return { sp, aplicar, toggle, pendente };
}

const dimPendente = (pendente: boolean) =>
  pendente ? "opacity-50 transition-opacity" : "transition-opacity";

// ============ CHIPS DE FILTROS ATIVOS ============

export function FiltrosAtivos({
  postos,
  blocos,
  meses,
  periodo,
}: {
  /** Postos selecionados (id + nome já resolvido no servidor). */
  postos: { id: string; nome: string }[];
  blocos: string[];
  meses: string[];
  /** Rótulo do período manual (De/Até), quando preenchido no formulário. */
  periodo: string | null;
}) {
  const { aplicar, toggle, pendente } = useFiltrosBI();
  const chips: { chave: string; rotulo: string; remover: () => void }[] = [
    ...postos.map((p) => ({
      chave: `posto:${p.id}`,
      rotulo: `Posto: ${p.nome}`,
      remover: () => toggle("posto", p.id),
    })),
    ...meses.map((m) => ({
      chave: `mes:${m}`,
      rotulo: `Mês: ${rotuloMes(m)}`,
      remover: () => toggle("mes", m),
    })),
    ...blocos.map((b) => ({
      chave: `bloco:${b}`,
      rotulo: `Bloco: ${b}`,
      remover: () => toggle("bloco", b),
    })),
    ...(periodo
      ? [
          {
            chave: "periodo",
            rotulo: `Período: ${periodo}`,
            remover: () => aplicar({ inicio: null, fim: null }),
          },
        ]
      : []),
  ];

  if (chips.length === 0) {
    return (
      <p className="mb-4 text-xs text-slate-400">
        💡 Clique nas barras, pontos e linhas dos gráficos para filtrar todo o
        painel — cada clique soma à seleção; clique de novo para desfazer.
      </p>
    );
  }

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-2 ${dimPendente(pendente)}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Filtros ativos:
      </span>
      {chips.map((c) => (
        <button
          key={c.chave}
          type="button"
          onClick={c.remover}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 py-1 pl-3 pr-2 text-xs font-semibold text-white hover:bg-blue-700"
          title="Remover filtro"
        >
          {c.rotulo}
          <span aria-hidden className="rounded-full bg-blue-500 px-1.5">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          aplicar({ posto: null, bloco: null, mes: null, inicio: null, fim: null })
        }
        className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
      >
        Limpar tudo
      </button>
    </div>
  );
}

// ============ EVOLUÇÃO MENSAL (clique nos meses soma à seleção) ============

export function EvolucaoChart({
  dados,
  mesesSelecionados = [],
}: {
  dados: { mes: string; score: number; visitas: number }[];
  mesesSelecionados?: string[];
}) {
  const { toggle, pendente } = useFiltrosBI();

  return (
    <div className={`cursor-pointer ${dimPendente(pendente)}`}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={dados}
          margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
          onClick={(e) => {
            const mes = e?.activeLabel;
            if (mes) toggle("mes", String(mes));
          }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            tickFormatter={rotuloMes}
            tick={{ fontSize: 12, fill: TEXTO_MUTED }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: TEXTO_MUTED }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [Number(v).toFixed(1), "Score"]}
            labelFormatter={(l) => `${rotuloMes(String(l))} — clique para filtrar`}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={AZUL}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: { mes: string };
              };
              const haSelecao = mesesSelecionados.length > 0;
              const ativo = mesesSelecionados.includes(payload.mes);
              return (
                <circle
                  key={payload.mes}
                  cx={cx}
                  cy={cy}
                  r={ativo ? 8 : 6}
                  fill={AZUL}
                  fillOpacity={haSelecao && !ativo ? 0.35 : 1}
                  stroke={ativo ? "#1e3a8a" : "#fff"}
                  strokeWidth={ativo ? 3 : 1.5}
                  cursor="pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggle("mes", payload.mes);
                  }}
                />
              );
            }}
            // activeDot desabilitado: ele cobriria o ponto customizado e
            // capturaria o clique do cross-filter
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ RANKING DE POSTOS (clique nas barras soma à seleção) ============

export function RankingChart({
  dados,
  postosSelecionados = [],
}: {
  dados: { postoId: string; nome: string; score: number }[];
  postosSelecionados?: string[];
}) {
  const { toggle, pendente } = useFiltrosBI();
  const altura = Math.max(160, dados.length * 44 + 40);
  const haSelecao = postosSelecionados.length > 0;

  return (
    <div className={dimPendente(pendente)}>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: TEXTO_MUTED }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={140}
            tick={{ fontSize: 12, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(v) => [Number(v).toFixed(1), "Score médio"]} />
          <Bar dataKey="score" barSize={20} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="score"
              position="right"
              formatter={(v: unknown) => Number(v).toFixed(1)}
              style={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
            />
            {dados.map((d) => {
              const apagado = haSelecao && !postosSelecionados.includes(d.postoId);
              return (
                <Cell
                  key={d.postoId}
                  fill={corPorScore(d.score)}
                  fillOpacity={apagado ? 0.3 : 1}
                  cursor="pointer"
                  onClick={() => toggle("posto", d.postoId)}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ MATRIZ (clique nos pontos soma blocos à seleção) ============

export function MatrizChart({
  dados,
  limiarDesempenho = 85,
  blocosSelecionados = [],
}: {
  dados: {
    nome: string;
    importancia: number;
    desempenho: number;
    prioridadeEstrategica: boolean;
  }[];
  limiarDesempenho?: number;
  blocosSelecionados?: string[];
}) {
  const { toggle, pendente } = useFiltrosBI();
  const prioridades = dados.filter((d) => d.prioridadeEstrategica);
  const demais = dados.filter((d) => !d.prioridadeEstrategica);
  const haSelecao = blocosSelecionados.length > 0;

  const formaPonto = (cor: string) =>
    function Ponto(props: unknown) {
      const { cx, cy, payload } = props as {
        cx: number;
        cy: number;
        payload: { nome: string };
      };
      const ativo = blocosSelecionados.includes(payload.nome);
      return (
        <circle
          cx={cx}
          cy={cy}
          r={ativo ? 9 : 6}
          fill={cor}
          fillOpacity={haSelecao && !ativo ? 0.35 : 1}
          stroke={ativo ? "#0f172a" : "#fff"}
          strokeWidth={ativo ? 2.5 : 1.5}
          cursor="pointer"
          onClick={() => toggle("bloco", payload.nome)}
        />
      );
    };

  return (
    <div className={dimPendente(pendente)}>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 12, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="desempenho"
            name="Desempenho"
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: TEXTO_MUTED }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            label={{
              value: "Desempenho (score)",
              position: "insideBottom",
              offset: -2,
              style: { fontSize: 12, fill: TEXTO_MUTED },
            }}
          />
          <YAxis
            type="number"
            dataKey="importancia"
            name="Importância"
            tick={{ fontSize: 12, fill: TEXTO_MUTED }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Importância (%)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: TEXTO_MUTED },
            }}
          />
          <ReferenceLine x={limiarDesempenho} stroke="#94a3b8" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as
                | { nome: string; importancia: number; desempenho: number }
                | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
                  <p className="font-semibold text-slate-900">{p.nome}</p>
                  <p className="text-slate-600">
                    desempenho {p.desempenho.toFixed(1)} · importância{" "}
                    {p.importancia.toFixed(1)}%
                  </p>
                  <p className="mt-0.5 text-slate-400">clique para filtrar</p>
                </div>
              );
            }}
          />
          <Scatter data={demais} fill={AZUL} shape={formaPonto(AZUL)} />
          <Scatter data={prioridades} fill="#dc2626" shape={formaPonto("#dc2626")} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
          Bloco dentro do esperado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
          Prioridade estratégica (alta importância, baixo desempenho)
        </span>
      </div>
    </div>
  );
}

// ============ TABELA DE BLOCOS (clique nas linhas soma à seleção) ============

export function BlocosTable({
  dados,
  blocosSelecionados = [],
}: {
  dados: { nome: string; score: number; importancia: number }[];
  blocosSelecionados?: string[];
}) {
  const { toggle, pendente } = useFiltrosBI();
  const haSelecao = blocosSelecionados.length > 0;

  return (
    <div className={`overflow-x-auto ${dimPendente(pendente)}`}>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4">Bloco</th>
            <th className="py-2 pr-4">Importância</th>
            <th className="py-2">Score médio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dados.map((b) => {
            const ativo = blocosSelecionados.includes(b.nome);
            return (
              <tr
                key={b.nome}
                onClick={() => toggle("bloco", b.nome)}
                title={ativo ? "Clique para remover o filtro" : "Clique para somar este bloco ao filtro do painel"}
                className={`cursor-pointer transition-colors ${
                  ativo
                    ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
                    : "hover:bg-slate-50"
                } ${haSelecao && !ativo ? "opacity-50" : ""}`}
              >
                <td className="py-2 pr-4 font-medium">{b.nome}</td>
                <td className="py-2 pr-4">{b.importancia.toFixed(1)}%</td>
                <td
                  className={`py-2 font-semibold ${
                    b.score < 75
                      ? "text-red-600"
                      : b.score < 85
                        ? "text-amber-600"
                        : "text-emerald-700"
                  }`}
                >
                  {b.score.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============ OPORTUNIDADES POR POSTO (clique soma o posto à seleção) ============

export function OportunidadePosto({
  postoId,
  posto,
  postosSelecionados = [],
  children,
}: {
  postoId: string;
  posto: string;
  postosSelecionados?: string[];
  children: React.ReactNode;
}) {
  const { toggle, pendente } = useFiltrosBI();
  const haSelecao = postosSelecionados.length > 0;
  const ativo = postosSelecionados.includes(postoId);
  return (
    <div
      onClick={() => toggle("posto", postoId)}
      title={ativo ? "Clique para remover o filtro" : "Clique para somar este posto ao filtro do painel"}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${dimPendente(pendente)} ${
        ativo
          ? "border-blue-300 bg-blue-50"
          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
      } ${haSelecao && !ativo ? "opacity-50" : ""}`}
    >
      <p className="font-semibold text-slate-900">{posto}</p>
      {children}
    </div>
  );
}
