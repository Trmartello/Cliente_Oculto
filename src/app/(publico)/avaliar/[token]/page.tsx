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
      questionario: {
        include: {
          blocos: {
            orderBy: { ordem: "asc" },
            include: { perguntas: { orderBy: { ordem: "asc" } } },
          },
        },
      },
      respostas: { include: { evidencias: { select: { id: true } } } },
    },
  });

  const respostasIniciais: Record<
    string,
    { valor: string | null; naoSeAplica: boolean; comentario: string | null }
  > = {};
  const evidenciasIniciais: Record<string, string[]> = {};
  for (const r of visita.respostas) {
    respostasIniciais[r.perguntaId] = {
      valor: r.valor,
      naoSeAplica: r.naoSeAplica,
      comentario: r.comentario,
    };
    if (r.evidencias.length > 0) {
      evidenciasIniciais[r.perguntaId] = r.evidencias.map((e) => e.id);
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
      evidenciasIniciais={evidenciasIniciais}
    />
  );
}
