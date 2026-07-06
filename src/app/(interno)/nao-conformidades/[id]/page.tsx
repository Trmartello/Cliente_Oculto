import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { escopoNC, podeEditar } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { atualizarStatusAcao } from "@/actions/ncs";
import { Badge, Card, PageHeader, btnSecundario } from "@/components/ui";
import {
  COR_PRIORIDADE,
  COR_STATUS_NC,
  ROTULO_ORIGEM_NC,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_NC,
  formatarData,
} from "@/lib/formato";
import { AcaoNovaForm, FotoCorrecao, NcEditarForm } from "./nc-forms";

export const metadata = { title: "Não Conformidade — Cliente Oculto" };

const ROTULO_STATUS_ACAO: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export default async function NcDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const nc = await prisma.naoConformidade.findFirst({
    where: { id, ...escopoNC(sessao) },
    include: {
      visita: { include: { posto: true } },
      pergunta: true,
      responsavel: true,
      acoes: {
        orderBy: { criadoEm: "asc" },
        include: {
          responsavel: { select: { nome: true } },
          evidencias: { select: { id: true } },
        },
      },
    },
  });
  if (!nc) notFound();

  const editor = podeEditar(sessao);
  const usuarios = editor
    ? await prisma.usuario.findMany({
        where: { ativo: true, papel: { not: "CONSULTA" } },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      })
    : [];

  return (
    <div>
      <PageHeader
        titulo="Não Conformidade"
        descricao={`${nc.visita.posto.nome} · origem: ${ROTULO_ORIGEM_NC[nc.origem]}`}
        acoes={
          <div className="flex gap-2">
            <Badge cor={COR_PRIORIDADE[nc.prioridade]}>
              {ROTULO_PRIORIDADE[nc.prioridade]}
            </Badge>
            <Badge cor={COR_STATUS_NC[nc.status]}>
              {ROTULO_STATUS_NC[nc.status]}
            </Badge>
          </div>
        }
      />

      <Card className="mb-6">
        <p className="font-medium text-slate-900">{nc.descricao}</p>
        {nc.pergunta && (
          <p className="mt-1 text-sm text-slate-500">
            Pergunta de origem: “{nc.pergunta.texto}”
          </p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Detectada em {formatarData(nc.criadoEm)} ·{" "}
          <Link
            href={`/visitas/${nc.visitaId}`}
            className="text-blue-700 hover:underline"
          >
            ver avaliação completa
          </Link>
        </p>
        {nc.dataConclusao && (
          <p className="mt-1 text-sm text-emerald-700">
            Resolvida em {formatarData(nc.dataConclusao)}
          </p>
        )}
      </Card>

      {editor && (
        <Card className="mb-6">
          <h2 className="mb-3 font-semibold text-slate-900">Tratamento</h2>
          <NcEditarForm
            nc={{
              id: nc.id,
              prioridade: nc.prioridade,
              status: nc.status,
              responsavelId: nc.responsavelId ?? "",
              prazo: nc.prazo ? nc.prazo.toISOString().slice(0, 10) : "",
            }}
            usuarios={usuarios}
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">
          Plano de ação ({nc.acoes.length})
        </h2>
        <div className="space-y-3">
          {nc.acoes.map((acao) => (
            <div
              key={acao.id}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{acao.descricao}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ROTULO_PRIORIDADE[acao.prioridade]}
                    {acao.responsavel && ` · ${acao.responsavel.nome}`}
                    {acao.prazo && ` · prazo ${formatarData(acao.prazo)}`}
                    {acao.dataConclusao &&
                      ` · concluída em ${formatarData(acao.dataConclusao)}`}
                  </p>
                </div>
                <Badge
                  cor={
                    acao.status === "CONCLUIDA"
                      ? "bg-emerald-100 text-emerald-800"
                      : acao.status === "EM_ANDAMENTO"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }
                >
                  {ROTULO_STATUS_ACAO[acao.status]}
                </Badge>
              </div>

              {acao.evidencias.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {acao.evidencias.map((e) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={e.id}
                      src={`/api/evidencia/${e.id}`}
                      alt="Foto da correção"
                      className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}

              {editor && acao.status !== "CONCLUIDA" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {acao.status === "PENDENTE" && (
                    <form
                      action={atualizarStatusAcao.bind(
                        null,
                        acao.id,
                        "EM_ANDAMENTO",
                      )}
                    >
                      <button type="submit" className={btnSecundario}>
                        Iniciar
                      </button>
                    </form>
                  )}
                  <form
                    action={atualizarStatusAcao.bind(null, acao.id, "CONCLUIDA")}
                  >
                    <button type="submit" className={btnSecundario}>
                      Concluir
                    </button>
                  </form>
                  <FotoCorrecao acaoId={acao.id} />
                </div>
              )}
            </div>
          ))}
          {nc.acoes.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhuma ação corretiva registrada ainda.
            </p>
          )}
        </div>

        {editor && nc.status !== "RESOLVIDA" && nc.status !== "CANCELADA" && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <AcaoNovaForm naoConformidadeId={nc.id} usuarios={usuarios} />
          </div>
        )}
      </Card>
    </div>
  );
}
