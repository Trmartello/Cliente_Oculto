import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { podeAdministrar, escopoVisita } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { cancelarVisita, revogarLink } from "@/actions/visitas";
import { Badge, Card, PageHeader, btnPerigo } from "@/components/ui";
import {
  COR_CRITICIDADE,
  COR_FAIXA,
  COR_PRIORIDADE,
  COR_STATUS_NC,
  COR_STATUS_VISITA,
  ROTULO_CRITICIDADE,
  ROTULO_FAIXA,
  ROTULO_ORIGEM_NC,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_NC,
  ROTULO_STATUS_VISITA,
  formatarData,
  formatarDataHora,
  formatarScore,
} from "@/lib/formato";
import { NovoLinkForm } from "./novo-link-form";

export const metadata = { title: "Visita — Cliente Oculto" };

interface ScoreBlocoSnapshot {
  blocoId: string;
  nome: string;
  peso: number;
  pesoNormalizado: number;
  pontua: boolean;
  score: number | null;
}

interface OportunidadeSnapshot {
  nome: string;
  importancia: number;
  desempenho: number;
  impacto: number;
}

function valorLegivel(valor: string | null, naoSeAplica: boolean): string {
  if (naoSeAplica) return "Não se aplica";
  if (valor === null || valor === "") return "—";
  const mapa: Record<string, string> = {
    SIM: "Sim",
    NAO: "Não",
    ATENDE: "Atende",
    NAO_ATENDE: "Não atende",
  };
  return mapa[valor] ?? valor;
}

function EstrelasLidas({ nota }: { nota: number }) {
  return (
    <span
      className="whitespace-nowrap"
      aria-label={`${nota} de 5 estrelas`}
      title={`${nota} de 5`}
    >
      <span className="text-base leading-none text-amber-500">
        {"★".repeat(nota)}
      </span>
      <span className="text-base leading-none text-slate-300">
        {"★".repeat(5 - nota)}
      </span>
      <span className="ml-1 align-middle text-xs text-slate-500">
        {nota}/5
      </span>
    </span>
  );
}

export default async function VisitaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const admin = podeAdministrar(sessao);

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
      token: true,
      respostas: { include: { evidencias: true } },
      naoConformidades: true,
    },
  });
  if (!visita) notFound();

  const respostaPorPergunta = new Map(
    visita.respostas.map((r) => [r.perguntaId, r]),
  );
  const scoresPorBloco =
    (visita.scoresPorBloco as unknown as ScoreBlocoSnapshot[] | null) ?? [];
  const scorePorBlocoId = new Map(scoresPorBloco.map((s) => [s.blocoId, s]));
  const matriz = visita.matrizJson as unknown as {
    topOportunidades?: OportunidadeSnapshot[];
  } | null;

  const linkGerenciavel =
    admin && visita.status !== "ENVIADA" && visita.status !== "CANCELADA";

  return (
    <div>
      <PageHeader
        titulo={`Visita — ${visita.posto.nome}`}
        descricao={`${visita.questionario.nome} (v${visita.questionario.versao}) · prevista para ${formatarData(visita.dataAgendada)}`}
        acoes={
          <div className="flex items-center gap-2">
            <Badge cor={COR_STATUS_VISITA[visita.status]}>
              {ROTULO_STATUS_VISITA[visita.status]}
            </Badge>
            {visita.temFalhaCritica && (
              <Badge cor="bg-red-600 text-white">Falha crítica</Badge>
            )}
          </div>
        }
      />

      {/* Resumo do resultado */}
      {visita.status === "ENVIADA" && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Score final
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {formatarScore(visita.scoreFinal)}
            </p>
            {visita.scoreBruto !== null &&
              Number(visita.scoreBruto) !== Number(visita.scoreFinal) && (
                <p className="text-xs text-slate-500">
                  bruto {formatarScore(visita.scoreBruto)} — penalidade por
                  falha crítica aplicada
                </p>
              )}
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase text-slate-500">
              IGEO
            </p>
            <p className="mt-2">
              {visita.faixaIgeo && (
                <Badge cor={COR_FAIXA[visita.faixaIgeo]}>
                  {ROTULO_FAIXA[visita.faixaIgeo]}
                </Badge>
              )}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Enviada em
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatarDataHora(visita.dataEnvio)}
            </p>
            <p className="text-xs text-slate-500">
              por {visita.avaliadorNome ?? "avaliador anônimo"}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Não conformidades
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {visita.naoConformidades.length}
            </p>
          </Card>
        </div>
      )}

      {/* Top oportunidades da visita */}
      {matriz?.topOportunidades && matriz.topOportunidades.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-900">
            Maiores oportunidades de melhoria
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {matriz.topOportunidades.map((o) => (
              <li key={o.nome}>
                <strong>{o.nome}</strong> — desempenho{" "}
                {formatarScore(o.desempenho)} com importância de{" "}
                {formatarScore(o.importancia)}%
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Gestão do link */}
      {linkGerenciavel && (
        <Card className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-900">
            Link do avaliador
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            {visita.token
              ? visita.token.status === "ATIVO"
                ? `Link ativo, válido até ${formatarDataHora(visita.token.expiraEm)}.`
                : `Link ${visita.token.status === "USADO" ? "já utilizado" : visita.token.status === "EXPIRADO" ? "expirado" : "revogado"}.`
              : "Nenhum link gerado."}{" "}
            O endereço completo só é exibido no momento da geração.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <NovoLinkForm visitaId={visita.id} />
            {visita.token?.status === "ATIVO" && (
              <form action={revogarLink.bind(null, visita.id)}>
                <button type="submit" className={btnPerigo}>
                  Revogar link
                </button>
              </form>
            )}
            <form action={cancelarVisita.bind(null, visita.id)}>
              <button type="submit" className={btnPerigo}>
                Cancelar visita
              </button>
            </form>
          </div>
        </Card>
      )}

      {/* NCs geradas */}
      {visita.naoConformidades.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 font-semibold text-slate-900">
            Não conformidades desta visita
          </h2>
          <ul className="space-y-2">
            {visita.naoConformidades.map((nc) => (
              <li
                key={nc.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Badge cor={COR_PRIORIDADE[nc.prioridade]}>
                  {ROTULO_PRIORIDADE[nc.prioridade]}
                </Badge>
                <Badge cor={COR_STATUS_NC[nc.status]}>
                  {ROTULO_STATUS_NC[nc.status]}
                </Badge>
                <span className="text-slate-500">
                  {ROTULO_ORIGEM_NC[nc.origem]}:
                </span>
                <Link
                  href={`/nao-conformidades/${nc.id}`}
                  className="text-blue-700 hover:underline"
                >
                  {nc.descricao}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Respostas por bloco */}
      {visita.status === "ENVIADA" && (
        <div className="space-y-4">
          {visita.questionario.blocos.map((bloco) => {
            const snapshot = scorePorBlocoId.get(bloco.id);
            return (
              <Card key={bloco.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{bloco.nome}</h3>
                  <span className="text-sm text-slate-500">
                    peso {Number(bloco.peso).toFixed(0)}% · score do bloco:{" "}
                    <strong className="text-slate-900">
                      {snapshot?.score != null
                        ? formatarScore(snapshot.score)
                        : "N/A"}
                    </strong>
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {bloco.perguntas.map((p) => {
                    const r = respostaPorPergunta.get(p.id);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm"
                      >
                        <div className="max-w-xl">
                          <p className="text-slate-800">{p.texto}</p>
                          {r?.comentario && (
                            <p className="mt-0.5 text-xs italic text-slate-500">
                              “{r.comentario}”
                            </p>
                          )}
                          {r && r.evidencias.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {r.evidencias.map((e) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={e.id}
                                  src={`/api/evidencia/${e.id}`}
                                  alt="Evidência fotográfica"
                                  className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {r?.criticidadeSnapshot === "CRITICA" &&
                            r.reprovada && (
                              <Badge cor="bg-red-600 text-white">
                                Falha crítica
                              </Badge>
                            )}
                          {p.criticidade !== "MEDIA" && (
                            <Badge cor={COR_CRITICIDADE[p.criticidade]}>
                              {ROTULO_CRITICIDADE[p.criticidade]}
                            </Badge>
                          )}
                          {p.tipo === "NOTA_1_5" &&
                          r?.valor &&
                          !r.naoSeAplica ? (
                            <EstrelasLidas nota={Number(r.valor)} />
                          ) : (
                            <span
                              className={`font-semibold ${
                                r?.reprovada ? "text-red-600" : "text-slate-900"
                              }`}
                            >
                              {valorLegivel(
                                r?.valor ?? null,
                                r?.naoSeAplica ?? false,
                              )}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
