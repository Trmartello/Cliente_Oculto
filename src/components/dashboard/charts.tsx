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

// ============ CROSS-FILTER (estilo BI) ============
// O clique num elemento gráfico grava o filtro na URL; o servidor recalcula
// todo o painel (com RBAC) e o estado filtrado vira um link compartilhável.

function useFiltrosBI() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();

  function aplicar(mudancas: Record<string, string | null>) {
    const qs = new URLSearchParams(sp.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") qs.delete(chave);
      else qs.set(chave, valor);
    }
    startTransition(() => {
      router.replace(`?${qs.toString()}`, { scroll: false });
    });
  }

  return { sp, aplicar, pendente };
}

/** Período (inicio/fim) que cobre exatamente o mês "AAAA-MM". */
function periodoDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

const dimPendente = (pendente: boolean) =>
  pendente ? "opacity-50 transition-opacity" : "transition-opacity";

// ============ CHIPS DE FILTROS ATIVOS ============

export function FiltrosAtivos({
  postoNome,
  blocoNome,
  mesSelecionado,
}: {
  postoNome: string | null;
  blocoNome: string | null;
  mesSelecionado: string | null;
}) {
  const { aplicar, pendente } = useFiltrosBI();
  const chips: { rotulo: string; remover: Record<string, null> }[] = [];
  if (postoNome) chips.push({ rotulo: `Posto: ${postoNome}`, remover: { posto: null } });
  if (mesSelecionado)
    chips.push({
      rotulo: `Período: ${rotuloMes(mesSelecionado)}`,
      remover: { inicio: null, fim: null },
    });
  if (blocoNome) chips.push({ rotulo: `Bloco: ${blocoNome}`, remover: { bloco: null } });

  if (chips.length === 0) {
    return (
      <p className="mb-4 text-xs text-slate-400">
        💡 Clique nas barras, pontos e linhas dos gráficos para filtrar todo o
        painel — clique de novo para desfazer.
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
          key={c.rotulo}
          type="button"
          onClick={() => aplicar(c.remover)}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 py-1 pl-3 pr-2 text-xs font-semibold text-white hover:bg-blue-700"
          title="Remover filtro"
        >
          {c.rotulo}
          <span aria-hidden className="rounded-full bg-blue-500 px-1.5">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => aplicar({ posto: null, bloco: null, inicio: null, fim: null })}
        className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
      >
        Limpar tudo
      </button>
    </div>
  );
}

// ============ EVOLUÇÃO MENSAL (clique no mês filtra o período) ============

export function EvolucaoChart({
  dados,
  mesSelecionado,
}: {
  dados: { mes: string; score: number; visitas: number }[];
  mesSelecionado?: string | null;
}) {
  const { aplicar, pendente } = useFiltrosBI();

  function toggleMes(mes: string) {
    if (mesSelecionado === mes) aplicar({ inicio: null, fim: null });
    else aplicar(periodoDoMes(mes));
  }

  return (
    <div className={`cursor-pointer ${dimPendente(pendente)}`}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={dados}
          margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
          onClick={(e) => {
            const mes = e?.activeLabel;
            if (mes) toggleMes(String(mes));
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
              const ativo = payload.mes === mesSelecionado;
              return (
                <circle
                  key={payload.mes}
                  cx={cx}
                  cy={cy}
                  r={ativo ? 8 : 6}
                  fill={AZUL}
                  stroke={ativo ? "#1e3a8a" : "#fff"}
                  strokeWidth={ativo ? 3 : 1.5}
                  cursor="pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleMes(payload.mes);
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

// ============ RANKING DE POSTOS (clique na barra filtra o posto) ============

export function RankingChart({
  dados,
  postoSelecionadoId,
}: {
  dados: { postoId: string; nome: string; score: number }[];
  postoSelecionadoId?: string | null;
}) {
  const { aplicar, pendente } = useFiltrosBI();
  const altura = Math.max(160, dados.length * 44 + 40);

  function togglePosto(id: string) {
    aplicar({ posto: postoSelecionadoId === id ? null : id });
  }

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
              const apagado =
                postoSelecionadoId && postoSelecionadoId !== d.postoId;
              return (
                <Cell
                  key={d.postoId}
                  fill={corPorScore(d.score)}
                  fillOpacity={apagado ? 0.3 : 1}
                  cursor="pointer"
                  onClick={() => togglePosto(d.postoId)}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ MATRIZ (clique no ponto filtra o bloco) ============

export function MatrizChart({
  dados,
  limiarDesempenho = 85,
  blocoSelecionado,
}: {
  dados: {
    nome: string;
    importancia: number;
    desempenho: number;
    prioridadeEstrategica: boolean;
  }[];
  limiarDesempenho?: number;
  blocoSelecionado?: string | null;
}) {
  const { aplicar, pendente } = useFiltrosBI();
  const prioridades = dados.filter((d) => d.prioridadeEstrategica);
  const demais = dados.filter((d) => !d.prioridadeEstrategica);

  function toggleBloco(nome: string) {
    aplicar({ bloco: blocoSelecionado === nome ? null : nome });
  }

  const formaPonto = (cor: string) =>
    function Ponto(props: unknown) {
      const { cx, cy, payload } = props as {
        cx: number;
        cy: number;
        payload: { nome: string };
      };
      const ativo = payload.nome === blocoSelecionado;
      return (
        <circle
          cx={cx}
          cy={cy}
          r={ativo ? 9 : 6}
          fill={cor}
          fillOpacity={blocoSelecionado && !ativo ? 0.35 : 1}
          stroke={ativo ? "#0f172a" : "#fff"}
          strokeWidth={ativo ? 2.5 : 1.5}
          cursor="pointer"
          onClick={() => toggleBloco(payload.nome)}
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

// ============ TABELA DE BLOCOS (clique na linha filtra o bloco) ============

export function BlocosTable({
  dados,
  blocoSelecionado,
}: {
  dados: { nome: string; score: number; importancia: number }[];
  blocoSelecionado?: string | null;
}) {
  const { aplicar, pendente } = useFiltrosBI();

  function toggleBloco(nome: string) {
    aplicar({ bloco: blocoSelecionado === nome ? null : nome });
  }

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
            const ativo = b.nome === blocoSelecionado;
            return (
              <tr
                key={b.nome}
                onClick={() => toggleBloco(b.nome)}
                title={ativo ? "Clique para remover o filtro" : "Clique para filtrar o painel por este bloco"}
                className={`cursor-pointer transition-colors ${
                  ativo
                    ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
                    : "hover:bg-slate-50"
                } ${blocoSelecionado && !ativo ? "opacity-50" : ""}`}
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

// ============ OPORTUNIDADES POR POSTO (clique no posto filtra) ============

export function OportunidadePosto({
  postoId,
  posto,
  postoSelecionadoId,
  children,
}: {
  postoId: string;
  posto: string;
  postoSelecionadoId?: string | null;
  children: React.ReactNode;
}) {
  const { aplicar, pendente } = useFiltrosBI();
  const ativo = postoSelecionadoId === postoId;
  return (
    <div
      onClick={() => aplicar({ posto: ativo ? null : postoId })}
      title={ativo ? "Clique para remover o filtro" : "Clique para filtrar o painel por este posto"}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${dimPendente(pendente)} ${
        ativo
          ? "border-blue-300 bg-blue-50"
          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
      } ${postoSelecionadoId && !ativo ? "opacity-50" : ""}`}
    >
      <p className="font-semibold text-slate-900">{posto}</p>
      {children}
    </div>
  );
}
