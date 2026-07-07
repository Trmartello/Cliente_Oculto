import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoVisita } from "@/lib/rbac";
import { rotuloFaixa } from "@/domain/score/igeo";
import {
  ROTULO_CRITICIDADE,
  formatarData,
  formatarDataHora,
  formatarScore,
} from "@/lib/formato";
import { BotaoImprimir } from "./botao-imprimir";

export const metadata = { title: "Relatório da visita — Cliente Oculto" };

interface ScoreBlocoSnapshot {
  blocoId: string;
  nome: string;
  pesoNormalizado: number;
  pontua: boolean;
  score: number | null;
}

function valorLegivel(valor: string | null, tipo: string): string {
  if (valor === null || valor === "") return "—";
  switch (valor) {
    case "SIM":
      return "Sim";
    case "NAO":
      return "Não";
    case "ATENDE":
      return "Atende";
    case "NAO_ATENDE":
      return "Não atende";
    default:
      return tipo === "NOTA_1_5" ? `${valor}/5 ★` : valor;
  }
}

export default async function ImprimirVisitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const visita = await prisma.visita.findFirst({
    where: { id, ...escopoVisita(sessao) },
    include: {
      posto: true,
      questionario: {
        include: {
          blocos: {
            orderBy: { ordem: "asc" },
            include: { perguntas: { orderBy: { ordem: "asc" } } },
          },
        },
      },
      respostas: {
        include: {
          observacoes: {
            orderBy: { criadoEm: "asc" },
            include: { evidencias: { orderBy: { criadoEm: "asc" } } },
          },
          evidencias: {
            where: { observacaoId: null },
            orderBy: { criadoEm: "asc" },
          },
        },
      },
      blocosRespostas: true,
      naoConformidades: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!visita || visita.status !== "ENVIADA") notFound();

  const respostaPorPergunta = new Map(
    visita.respostas.map((r) => [r.perguntaId, r]),
  );
  const naPorBloco = new Map(
    visita.blocosRespostas.filter((b) => b.naoSeAplica).map((b) => [b.blocoId, b]),
  );
  const scoresPorBloco =
    (visita.scoresPorBloco as unknown as ScoreBlocoSnapshot[] | null) ?? [];
  const scorePorBlocoId = new Map(scoresPorBloco.map((s) => [s.blocoId, s]));
  const score = visita.scoreFinal === null ? null : Number(visita.scoreFinal);

  return (
    <div className="mx-auto max-w-3xl text-slate-900">
      {/* barra de ações — some na impressão */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/visitas/${visita.id}`}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ‹ Voltar à visita
        </Link>
        <BotaoImprimir />
      </div>

      {/* cabeçalho */}
      <header className="border-b-2 border-slate-900 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Relatório de Cliente Oculto
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {visita.posto.nome} — {visita.posto.cidade}/{visita.posto.uf}
        </h1>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
          <p>Data prevista: {formatarData(visita.dataAgendada)}</p>
          <p>Enviada em: {formatarDataHora(visita.dataEnvio)}</p>
          <p>Avaliador: {visita.avaliadorNome ?? "anônimo"}</p>
          <p>Questionário: {visita.questionario.nome} (v{visita.questionario.versao})</p>
          {visita.envioLatitude !== null && visita.envioLongitude !== null && (
            <p>
              Local do envio: {Number(visita.envioLatitude).toFixed(5)},{" "}
              {Number(visita.envioLongitude).toFixed(5)}
              {visita.envioPrecisaoM !== null ? ` (±${visita.envioPrecisaoM} m)` : ""}
            </p>
          )}
        </div>
      </header>

      {/* score */}
      <section className="mt-5 flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Score final
          </p>
          <p className="text-4xl font-bold">
            {formatarScore(score)}
            <span className="ml-1 text-base font-medium text-slate-400">/100</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Faixa IGEO</p>
          <p className="text-lg font-semibold">
            {visita.faixaIgeo ? rotuloFaixa(visita.faixaIgeo) : "—"}
          </p>
        </div>
        {visita.temFalhaCritica && (
          <p className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
            FALHA CRÍTICA
          </p>
        )}
        {visita.scoreBruto !== null &&
          Number(visita.scoreBruto) !== score && (
            <p className="text-sm text-slate-500">
              (score antes da penalidade: {formatarScore(Number(visita.scoreBruto))})
            </p>
          )}
      </section>

      {/* não conformidades */}
      {visita.naoConformidades.length > 0 && (
        <section className="mt-5 print:break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-700">
            Não conformidades ({visita.naoConformidades.length})
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {visita.naoConformidades.map((nc) => (
              <li key={nc.id}>{nc.descricao}</li>
            ))}
          </ul>
        </section>
      )}

      {/* respostas por etapa */}
      {visita.questionario.blocos.map((bloco) => {
        const blocoNA = naPorBloco.get(bloco.id);
        const snapshot = scorePorBlocoId.get(bloco.id);
        return (
          <section key={bloco.id} className="mt-6 print:break-inside-avoid">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
              <h2 className="font-bold">{bloco.nome}</h2>
              <span className="text-sm text-slate-500">
                {blocoNA
                  ? "Não se aplica"
                  : `score ${snapshot?.score != null ? formatarScore(snapshot.score) : "N/A"}`}
              </span>
            </div>
            {blocoNA ? (
              <p className="mt-2 text-sm italic text-slate-600">
                Etapa marcada pelo avaliador como não aplicável
                {blocoNA.comentario ? ` — “${blocoNA.comentario}”` : "."}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {bloco.perguntas.map((p) => {
                  const r = respostaPorPergunta.get(p.id);
                  return (
                    <li key={p.id} className="py-2 text-sm print:break-inside-avoid">
                      <div className="flex items-start justify-between gap-4">
                        <p>
                          {p.texto}
                          {p.criticidade === "CRITICA" && (
                            <span className="ml-1 text-xs font-semibold text-red-600">
                              [{ROTULO_CRITICIDADE[p.criticidade]}]
                            </span>
                          )}
                        </p>
                        <p className={`shrink-0 font-semibold ${r?.reprovada ? "text-red-600" : ""}`}>
                          {r?.naoSeAplica
                            ? "Não se aplica"
                            : valorLegivel(r?.valor ?? null, p.tipo)}
                        </p>
                      </div>
                      {r?.comentario && (
                        <p className="mt-1 text-xs italic text-slate-500">
                          “{r.comentario}”
                        </p>
                      )}
                      {r?.observacoes.map((o) => (
                        <div key={o.id} className="mt-2 rounded border border-slate-200 p-2">
                          {o.texto && (
                            <p className="text-xs italic text-slate-600">“{o.texto}”</p>
                          )}
                          {o.evidencias.length > 0 && (
                            <div className={`flex flex-wrap gap-2 ${o.texto ? "mt-1.5" : ""}`}>
                              {o.evidencias.map((e) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={e.id}
                                  src={`/api/evidencia/${e.id}`}
                                  alt={o.texto ?? "Evidência fotográfica"}
                                  className="h-28 w-28 rounded border border-slate-200 object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {r && r.evidencias.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {r.evidencias.map((e) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={e.id}
                              src={`/api/evidencia/${e.id}`}
                              alt={e.legenda ?? "Evidência fotográfica"}
                              className="h-28 w-28 rounded border border-slate-200 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-400">
        Gerado em {formatarDataHora(new Date())} · Sistema Cliente Oculto
      </footer>
    </div>
  );
}
