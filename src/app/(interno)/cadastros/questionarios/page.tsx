import Link from "next/link";
import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  alterarStatusQuestionario,
  gerarNovaVersao,
} from "@/actions/questionarios";
import { Badge, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import { QuestionarioNovoForm } from "./questionario-novo-form";

export const metadata = { title: "Questionários — Cliente Oculto" };

const COR_STATUS: Record<string, string> = {
  RASCUNHO: "bg-amber-100 text-amber-800",
  ATIVO: "bg-emerald-100 text-emerald-800",
  ARQUIVADO: "bg-slate-100 text-slate-600",
};

const ROTULO_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  ARQUIVADO: "Arquivado",
};

export default async function QuestionariosPage() {
  await exigirPapel("ADMIN", "CONTROLADORIA");

  const questionarios = await prisma.questionario.findMany({
    orderBy: [{ nome: "asc" }, { versao: "desc" }],
    include: {
      _count: { select: { visitas: { where: { status: "ENVIADA" } } } },
      blocos: { select: { peso: true, _count: { select: { perguntas: true } } } },
    },
  });

  return (
    <div>
      <PageHeader
        titulo="Questionários"
        descricao="Modelos de avaliação — blocos, perguntas, pesos e criticidade são configuráveis sem alterar código"
      />

      <div className="mb-6">
        <QuestionarioNovoForm />
      </div>

      <Tabela
        cabecalhos={[
          "Nome",
          "Versão",
          "Status",
          "Blocos",
          "Perguntas",
          "Soma dos pesos",
          "Avaliações",
          "Ações",
        ]}
      >
        {questionarios.map((q) => {
          const somaPesos = q.blocos.reduce((s, b) => s + Number(b.peso), 0);
          const totalPerguntas = q.blocos.reduce(
            (s, b) => s + b._count.perguntas,
            0,
          );
          return (
            <tr key={q.id}>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/cadastros/questionarios/${q.id}`}
                  className="text-blue-700 hover:underline"
                >
                  {q.nome}
                </Link>
                {q.tipo === "AUDITORIA_OPERACIONAL" && (
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    Auditoria
                  </span>
                )}
              </td>
              <td className="px-4 py-3">v{q.versao}</td>
              <td className="px-4 py-3">
                <Badge cor={COR_STATUS[q.status]}>
                  {ROTULO_STATUS[q.status]}
                </Badge>
              </td>
              <td className="px-4 py-3">{q.blocos.length}</td>
              <td className="px-4 py-3">{totalPerguntas}</td>
              <td className="px-4 py-3">
                {somaPesos.toFixed(0)}%
                {somaPesos !== 100 && q.blocos.length > 0 && (
                  <span className="ml-1 text-xs text-amber-600">
                    (será normalizado)
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{q._count.visitas}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {q.status !== "ATIVO" &&
                    (totalPerguntas > 0 ? (
                      <form
                        action={alterarStatusQuestionario.bind(null, q.id, "ATIVO")}
                      >
                        <button type="submit" className={btnSecundario}>
                          Ativar
                        </button>
                      </form>
                    ) : (
                      // o servidor ignora a ativação sem perguntas — em vez
                      // de um botão que "não faz nada", explica o que falta
                      <span className="text-xs text-slate-400">
                        adicione perguntas para ativar
                      </span>
                    ))}
                  {q.status === "ATIVO" && (
                    <form
                      action={alterarStatusQuestionario.bind(
                        null,
                        q.id,
                        "ARQUIVADO",
                      )}
                    >
                      <button type="submit" className={btnSecundario}>
                        Arquivar
                      </button>
                    </form>
                  )}
                  {q._count.visitas > 0 && (
                    <form action={gerarNovaVersao.bind(null, q.id)}>
                      <button type="submit" className={btnSecundario}>
                        Nova versão
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Tabela>
    </div>
  );
}
