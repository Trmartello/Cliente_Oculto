import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoPosto, podeEditar } from "@/lib/rbac";
import {
  podeGerirPlanoDoPosto,
  sincronizarAcoesAtrasadas,
} from "@/lib/planos";
import { prazoVencido } from "@/lib/prazos";
import { excluirAcaoPlano, excluirIniciativa, excluirPlano } from "@/actions/planos";
import { FormConfirmar } from "@/components/confirmar";
import { Badge, Card, PageHeader, btnSecundario } from "@/components/ui";
import {
  COR_PRIORIDADE,
  COR_STATUS_ACAO_PLANO,
  COR_STATUS_PLANO,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_ACAO_PLANO,
  ROTULO_STATUS_PLANO,
  formatarData,
} from "@/lib/formato";
import { AcaoPlanoForm, IniciativaForm, PlanoEditarForm } from "../planos-forms";

export const metadata = { title: "Plano de Ação — Cliente Oculto" };

export default async function PlanoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  await sincronizarAcoesAtrasadas();

  const plano = await prisma.planoAcao.findFirst({
    where: { id, posto: escopoPosto(sessao) },
    include: {
      posto: { select: { id: true, nome: true, cidade: true, uf: true } },
      iniciativas: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        include: {
          acoes: {
            orderBy: { criadoEm: "asc" },
            include: { responsavel: { select: { nome: true } } },
          },
        },
      },
    },
  });
  if (!plano) notFound();

  const editor =
    podeEditar(sessao) && (await podeGerirPlanoDoPosto(sessao, plano.postoId));
  const usuarios = editor
    ? await prisma.usuario.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      })
    : [];

  const totalAcoes = plano.iniciativas.reduce(
    (s, i) => s + i.acoes.length,
    0,
  );
  // "vencida" independe do status manual: Em andamento com prazo estourado
  // continua contando (e aparecendo em vermelho), sem sobrescrever o status
  const acaoVencida = (a: { dataLimite: Date | null; status: string }) =>
    a.status === "ATRASADA" ||
    (prazoVencido(a.dataLimite) &&
      a.status !== "CONCLUIDA" &&
      a.status !== "CANCELADA");
  const atrasadas = plano.iniciativas
    .flatMap((i) => i.acoes)
    .filter(acaoVencida).length;

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/planos-de-acao"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ‹ Planos de ação
        </Link>
      </div>
      <PageHeader
        titulo={plano.problema}
        descricao={`${plano.posto.nome} — ${plano.posto.cidade}/${plano.posto.uf}${
          plano.blocoNome ? ` · etapa ${plano.blocoNome}` : " · plano avulso"
        }`}
        acoes={
          <div className="flex items-center gap-2">
            {editor && (
              <PlanoEditarForm
                plano={{
                  id: plano.id,
                  problema: plano.problema,
                  descricao: plano.descricao ?? "",
                  status: plano.status,
                }}
              />
            )}
            <Badge cor={COR_STATUS_PLANO[plano.status]}>
              {ROTULO_STATUS_PLANO[plano.status]}
            </Badge>
          </div>
        }
      />

      {plano.descricao && (
        <p className="mb-4 max-w-3xl text-sm text-slate-600">{plano.descricao}</p>
      )}

      <div className="mb-6 flex flex-wrap gap-4 text-sm text-slate-600">
        <span>
          <strong>{plano.iniciativas.length}</strong> iniciativa(s)
        </span>
        <span>
          <strong>{totalAcoes}</strong> ação(ões)
        </span>
        <span className={atrasadas > 0 ? "font-semibold text-red-600" : ""}>
          <strong>{atrasadas}</strong> atrasada(s)
        </span>
      </div>

      {editor && (
        <div className="mb-4">
          <IniciativaForm planoId={plano.id} iniciativa={null} />
        </div>
      )}

      {plano.iniciativas.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhuma iniciativa ainda. As inconsistências das próximas
            avaliações aparecem aqui automaticamente — ou crie uma iniciativa
            manualmente.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {plano.iniciativas.map((ini, idx) => (
          <Card key={ini.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  {idx + 1}. {ini.titulo}
                </h2>
                {ini.descricao && (
                  <p className="mt-0.5 text-sm text-slate-500">{ini.descricao}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge cor={COR_STATUS_PLANO[ini.status]}>
                  {ROTULO_STATUS_PLANO[ini.status]}
                </Badge>
                {editor && (
                  <>
                    <IniciativaForm
                      planoId={plano.id}
                      iniciativa={{
                        id: ini.id,
                        titulo: ini.titulo,
                        descricao: ini.descricao ?? "",
                        status: ini.status,
                      }}
                    />
                    {ini.acoes.length === 0 && (
                      <FormConfirmar
                        mensagem={`Excluir a iniciativa "${ini.titulo}"?`}
                        action={async () => {
                          "use server";
                          await excluirIniciativa(ini.id);
                        }}
                      >
                        <button
                          type="submit"
                          className={`${btnSecundario} text-red-600`}
                        >
                          Excluir
                        </button>
                      </FormConfirmar>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ações desdobradas */}
            {ini.acoes.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Ação</th>
                      <th className="py-2 pr-4">Responsável</th>
                      <th className="py-2 pr-4">Prioridade</th>
                      <th className="py-2 pr-4">Data-limite</th>
                      <th className="py-2 pr-4">Progresso</th>
                      <th className="py-2 pr-4">Status</th>
                      {editor && <th className="py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ini.acoes.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {a.titulo}
                          {a.descricao && (
                            <p className="text-xs font-normal text-slate-500">
                              {a.descricao}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {a.responsavel?.nome ?? a.responsavelNome ?? "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge cor={COR_PRIORIDADE[a.prioridade]}>
                            {ROTULO_PRIORIDADE[a.prioridade]}
                          </Badge>
                        </td>
                        <td
                          className={`py-2 pr-4 ${
                            acaoVencida(a)
                              ? "font-semibold text-red-600"
                              : "text-slate-600"
                          }`}
                        >
                          {a.dataLimite ? formatarData(a.dataLimite) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  a.progresso >= 100
                                    ? "bg-emerald-500"
                                    : "bg-blue-500"
                                }`}
                                style={{ width: `${a.progresso}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {a.progresso}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge cor={COR_STATUS_ACAO_PLANO[a.status]}>
                            {ROTULO_STATUS_ACAO_PLANO[a.status]}
                          </Badge>
                        </td>
                        {editor && (
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <AcaoPlanoForm
                                iniciativaId={ini.id}
                                usuarios={usuarios}
                                acao={{
                                  id: a.id,
                                  titulo: a.titulo,
                                  descricao: a.descricao ?? "",
                                  prioridade: a.prioridade,
                                  status: a.status,
                                  dataLimite: a.dataLimite
                                    ? a.dataLimite.toISOString().slice(0, 10)
                                    : "",
                                  responsavelNome: a.responsavelNome ?? "",
                                  responsavelId: a.responsavelId ?? "",
                                  progresso: a.progresso,
                                }}
                              />
                              <FormConfirmar
                                mensagem={`Excluir a ação "${a.titulo}"?`}
                                action={async () => {
                                  "use server";
                                  await excluirAcaoPlano(a.id);
                                }}
                              >
                                <button
                                  type="submit"
                                  className="text-xs text-slate-400 underline hover:text-red-600"
                                >
                                  excluir
                                </button>
                              </FormConfirmar>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {editor && (
              <div className="mt-3">
                <AcaoPlanoForm
                  iniciativaId={ini.id}
                  usuarios={usuarios}
                  acao={null}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {editor &&
        (sessao.papel === "ADMIN" || sessao.papel === "CONTROLADORIA") && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <FormConfirmar
              mensagem="Excluir o plano INTEIRO? Todas as iniciativas e ações deste plano serão apagadas de forma irreversível."
              action={async () => {
                "use server";
                await excluirPlano(plano.id);
              }}
            >
              <button
                type="submit"
                className={`${btnSecundario} text-red-600`}
              >
                Excluir plano inteiro
              </button>
            </FormConfirmar>
          </div>
        )}
    </div>
  );
}
