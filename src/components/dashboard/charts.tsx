"use client";

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

export function EvolucaoChart({
  dados,
}: {
  dados: { mes: string; score: number; visitas: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
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
          labelFormatter={(l) => rotuloMes(String(l))}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={AZUL}
          strokeWidth={2}
          dot={{ r: 4, fill: AZUL }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RankingChart({
  dados,
}: {
  dados: { nome: string; score: number }[];
}) {
  const altura = Math.max(160, dados.length * 44 + 40);
  return (
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
          {dados.map((d) => (
            <Cell key={d.nome} fill={corPorScore(d.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MatrizChart({
  dados,
  limiarDesempenho = 85,
}: {
  dados: {
    nome: string;
    importancia: number;
    desempenho: number;
    prioridadeEstrategica: boolean;
  }[];
  limiarDesempenho?: number;
}) {
  const prioridades = dados.filter((d) => d.prioridadeEstrategica);
  const demais = dados.filter((d) => !d.prioridadeEstrategica);
  return (
    <div>
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
                </div>
              );
            }}
          />
          <Scatter data={demais} fill={AZUL} />
          <Scatter data={prioridades} fill="#dc2626" />
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
