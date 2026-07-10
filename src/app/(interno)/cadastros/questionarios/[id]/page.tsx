import { notFound } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { excluirBloco, excluirPergunta } from "@/actions/questionarios";
import { FormConfirmar } from "@/components/confirmar";
import { Badge, Card, PageHeader, btnPerigo } from "@/components/ui";
import {
  COR_CRITICIDADE,
  ROTULO_CRITICIDADE,
  ROTULO_TIPO_PERGUNTA,
} from "@/lib/formato";
import { BlocoForm, ConfigForm, PerguntaForm } from "./builder-forms";

export const metadata = { title: "Questionário — Cliente Oculto" };

export default async function QuestionarioBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const { id } = await params;

  const questionario = await prisma.questionario.findUnique({
    where: { id },
    include: {
      blocos: {
        orderBy: { ordem: "asc" },
        include: { perguntas: { orderBy: { ordem: "asc" } } },
      },
      _count: { select: { visitas: { where: { status: "ENVIADA" } } } },
    },
  });
  if (!questionario) notFound();

  const editavel = questionario._count.visitas === 0;
  const somaPesosBlocos = questionario.blocos.reduce(
    (s, b) => s + Number(b.peso),
    0,
  );

  return (
    <div>
      <PageHeader
        titulo={`${questionario.nome} (v${questionario.versao})`}
        descricao={questionario.descricao ?? undefined}
        acoes={
          <Badge
            cor={
              questionario.status === "ATIVO"
                ? "bg-emerald-100 text-emerald-800"
                : questionario.status === "RASCUNHO"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }
          >
            {questionario.status === "ATIVO"
              ? "Ativo"
              : questionario.status === "RASCUNHO"
                ? "Rascunho"
                : "Arquivado"}
          </Badge>
        }
      />

      {!editavel && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este questionário já possui avaliações enviadas e não pode ser
          alterado. Para modificar pesos ou perguntas, gere uma nova versão na
          lista de questionários.
        </p>
      )}

      <div className="mb-6">
        <ConfigForm
          questionario={{
            id: questionario.id,
            nome: questionario.nome,
            descricao: questionario.descricao ?? "",
            tipo: questionario.tipo,
            penalidadeCriticaTipo: questionario.penalidadeCriticaTipo,
            penalidadeCriticaValor: Number(questionario.penalidadeCriticaValor),
          }}
          editavel={editavel}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Blocos</h2>
        <span
          className={`text-sm font-medium ${
            somaPesosBlocos === 100 ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          Soma dos pesos: {somaPesosBlocos.toFixed(0)}%
          {somaPesosBlocos !== 100 &&
            questionario.blocos.length > 0 &&
            " — será normalizada para 100% no cálculo"}
        </span>
      </div>

      <div className="space-y-4">
        {questionario.blocos.map((bloco) => {
          const somaPesosPerguntas = bloco.perguntas
            .filter((p) => !["TEXTO", "FOTO"].includes(p.tipo))
            .reduce((s, p) => s + Number(p.peso), 0);
          return (
            <Card key={bloco.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {bloco.nome}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      — peso {Number(bloco.peso).toFixed(0)}% · pesos das
                      perguntas: {somaPesosPerguntas.toFixed(0)}
                    </span>
                  </h3>
                </div>
                {editavel && (
                  <div className="flex gap-2">
                    <BlocoForm
                      questionarioId={questionario.id}
                      bloco={{
                        id: bloco.id,
                        nome: bloco.nome,
                        peso: Number(bloco.peso),
                      }}
                    />
                    <FormConfirmar
                      action={excluirBloco.bind(null, bloco.id)}
                      mensagem={`Excluir a etapa "${bloco.nome}"? Todas as perguntas dela serão apagadas junto.`}
                    >
                      <button type="submit" className={btnPerigo}>
                        Excluir bloco
                      </button>
                    </FormConfirmar>
                  </div>
                )}
              </div>

              {bloco.perguntas.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Pergunta</th>
                        <th className="py-2 pr-4">Tipo</th>
                        <th className="py-2 pr-4">Peso</th>
                        <th className="py-2 pr-4">Criticidade</th>
                        <th className="py-2 pr-4">Obrigatória</th>
                        <th className="py-2 pr-4">Permite N/A</th>
                        {editavel && <th className="py-2">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bloco.perguntas.map((p) => (
                        <tr key={p.id}>
                          <td className="max-w-md py-2 pr-4">{p.texto}</td>
                          <td className="py-2 pr-4">
                            {ROTULO_TIPO_PERGUNTA[p.tipo]}
                          </td>
                          <td className="py-2 pr-4">{Number(p.peso)}</td>
                          <td className="py-2 pr-4">
                            <Badge cor={COR_CRITICIDADE[p.criticidade]}>
                              {ROTULO_CRITICIDADE[p.criticidade]}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {p.obrigatoria ? "Sim" : "Não"}
                          </td>
                          <td className="py-2 pr-4">
                            {p.permiteNaoSeAplica ? "Sim" : "Não"}
                          </td>
                          {editavel && (
                            <td className="py-2">
                              <div className="flex gap-2">
                                <PerguntaForm
                                  blocoId={bloco.id}
                                  pergunta={{
                                    id: p.id,
                                    texto: p.texto,
                                    tipo: p.tipo,
                                    peso: Number(p.peso),
                                    criticidade: p.criticidade,
                                    obrigatoria: p.obrigatoria,
                                    permiteNaoSeAplica: p.permiteNaoSeAplica,
                                  }}
                                />
                                <FormConfirmar
                                  action={excluirPergunta.bind(null, p.id)}
                                  mensagem="Excluir esta pergunta do questionário?"
                                >
                                  <button type="submit" className={btnPerigo}>
                                    Excluir
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

              {editavel && (
                <div className="mt-3">
                  <PerguntaForm blocoId={bloco.id} pergunta={null} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editavel && (
        <div className="mt-4">
          <BlocoForm questionarioId={questionario.id} bloco={null} />
        </div>
      )}
    </div>
  );
}
