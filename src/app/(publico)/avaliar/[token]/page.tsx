import { prisma } from "@/lib/prisma";
import { validarToken } from "@/lib/token-avaliacao";
import { AvaliacaoWizard } from "./wizard";

export const metadata = { title: "Avaliação — Cliente Oculto" };

const MENSAGENS: Record<string, { titulo: string; texto: string }> = {
  INVALIDO: {
    titulo: "Link inválido",
    texto: "Este link de avaliação não existe. Confira o endereço recebido.",
  },
  EXPIRADO: {
    titulo: "Link expirado",
    texto:
      "O período de acesso a esta avaliação terminou. Solicite um novo link à Controladoria.",
  },
  USADO: {
    titulo: "Avaliação já enviada",
    texto:
      "Esta avaliação já foi concluída e enviada. Obrigado pela participação!",
  },
  REVOGADO: {
    titulo: "Link desativado",
    texto: "Este link foi desativado. Solicite um novo link à Controladoria.",
  },
};

export default async function AvaliarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validacao = await validarToken(token);

  if (!validacao.ok) {
    const m = MENSAGENS[validacao.motivo];
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{m.titulo}</h1>
        <p className="mt-2 max-w-sm text-slate-600">{m.texto}</p>
      </main>
    );
  }

  const visita = await prisma.visita.findUniqueOrThrow({
    where: { id: validacao.visitaId },
    include: {
      posto: true,
      token: { select: { expiraEm: true } },
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
            include: {
              evidencias: { orderBy: { criadoEm: "asc" }, select: { id: true } },
            },
          },
          // fotos antigas sem observação (modelo anterior) viram uma
          // observação inicial para continuarem visíveis/editáveis
          evidencias: {
            where: { observacaoId: null },
            orderBy: { criadoEm: "asc" },
            select: { id: true, legenda: true },
          },
        },
      },
      blocosRespostas: true,
    },
  });

  const respostasIniciais: Record<
    string,
    { valor: string | null; naoSeAplica: boolean; comentario: string | null }
  > = {};
  const observacoesIniciais: Record<
    string,
    { id: string; texto: string | null; fotos: string[] }[]
  > = {};
  for (const r of visita.respostas) {
    respostasIniciais[r.perguntaId] = {
      valor: r.valor,
      naoSeAplica: r.naoSeAplica,
      comentario: r.comentario,
    };
    const feed = r.observacoes.map((o) => ({
      id: o.id,
      texto: o.texto,
      fotos: o.evidencias.map((e) => e.id),
    }));
    // fotos do modelo anterior (sem observação): viram uma entrada inicial
    // somente leitura, para continuarem visíveis e contando na validação
    if (r.evidencias.length > 0) {
      feed.unshift({
        id: `legado:${r.id}`,
        texto: r.evidencias.map((e) => e.legenda).filter(Boolean).join(" · ") || null,
        fotos: r.evidencias.map((e) => e.id),
      });
    }
    if (feed.length > 0) observacoesIniciais[r.perguntaId] = feed;
  }

  // Etapas já marcadas como "não se aplica" pelo avaliador.
  const blocosNAIniciais: Record<
    string,
    { naoSeAplica: boolean; comentario: string }
  > = {};
  for (const b of visita.blocosRespostas) {
    if (b.naoSeAplica) {
      blocosNAIniciais[b.blocoId] = {
        naoSeAplica: true,
        comentario: b.comentario ?? "",
      };
    }
  }

  return (
    <AvaliacaoWizard
      token={token}
      posto={`${visita.posto.nome} — ${visita.posto.cidade}/${visita.posto.uf}`}
      blocos={visita.questionario.blocos.map((b) => ({
        id: b.id,
        nome: b.nome,
        perguntas: b.perguntas.map((p) => ({
          id: p.id,
          texto: p.texto,
          tipo: p.tipo,
          obrigatoria: p.obrigatoria,
          permiteNaoSeAplica: p.permiteNaoSeAplica,
        })),
      }))}
      respostasIniciais={respostasIniciais}
      observacoesIniciais={observacoesIniciais}
      blocosNAIniciais={blocosNAIniciais}
      jaEnviada={visita.status === "ENVIADA"}
      revisavelAte={
        visita.token
          ? new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "UTC",
            }).format(visita.token.expiraEm)
          : undefined
      }
    />
  );
}
