/**
 * Cria o questionário OFICIAL da rede em qualquer ambiente (idempotente:
 * se já existir um questionário com este nome, não faz nada).
 *
 * Uso local:     npx tsx prisma/questionario-oficial.ts
 * Uso no Railway: incluir no pre-deploy —
 *   npx prisma migrate deploy && npx tsx prisma/questionario-oficial.ts
 * (pode ficar permanente no pre-deploy; execuções seguintes são no-op)
 *
 * Pesos e criticidades são apenas o ponto de partida — a Controladoria
 * ajusta tudo depois em Cadastros → Questionários (novas versões).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOME = "Avaliação Oficial da Rede";

type Pergunta = {
  texto: string;
  tipo?: "NOTA_1_5" | "SIM_NAO" | "FOTO" | "TEXTO";
  peso: number;
  criticidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  naoSeAplica?: boolean;
  /** Default: obrigatória quando pontuável (estrelas). */
  obrigatoria?: boolean;
};

const BLOCOS: { nome: string; peso: number; perguntas: Pergunta[] }[] = [
  {
    nome: "Atendimento",
    peso: 30,
    perguntas: [
      { texto: "Recepção: o frentista cumprimentou e demonstrou atenção?", peso: 4, criticidade: "MEDIA" },
      { texto: "Apresentação pessoal e uniforme adequados?", peso: 4, criticidade: "MEDIA" },
      { texto: "Confirmou o combustível e o valor antes de abastecer?", peso: 8, criticidade: "CRITICA" },
      { texto: "Agilidade no atendimento (tempo de espera)?", peso: 5, criticidade: "ALTA" },
      { texto: "Cordialidade ao finalizar (agradeceu e convidou a voltar)?", peso: 3, criticidade: "BAIXA" },
    ],
  },
  {
    nome: "Segurança",
    peso: 20,
    perguntas: [
      { texto: "Solicitou que o motor fosse desligado antes de abastecer?", peso: 7, criticidade: "CRITICA" },
      { texto: "Frentista utilizava EPI completo?", peso: 5, criticidade: "ALTA" },
      { texto: "Ausência de uso de celular na pista?", peso: 4, criticidade: "ALTA" },
      { texto: "Organização e sinalização da pista?", peso: 4, criticidade: "MEDIA" },
    ],
  },
  {
    nome: "Venda Consultiva",
    peso: 20,
    perguntas: [
      { texto: "Ofereceu aditivo ou combustível premium?", peso: 5, criticidade: "MEDIA" },
      { texto: "Ofereceu verificação/troca de óleo e água?", peso: 3, criticidade: "MEDIA" },
      { texto: "Ofereceu calibragem dos pneus?", peso: 3, criticidade: "BAIXA" },
      { texto: "Divulgou o programa de fidelidade?", peso: 4, criticidade: "MEDIA" },
    ],
  },
  {
    nome: "Loja de Conveniência",
    peso: 15,
    perguntas: [
      { texto: "Organização e limpeza da loja?", peso: 5, criticidade: "MEDIA", naoSeAplica: true },
      { texto: "Produtos com precificação visível?", peso: 4, criticidade: "MEDIA", naoSeAplica: true },
      { texto: "Disponibilidade de produtos nas gôndolas?", peso: 3, criticidade: "BAIXA", naoSeAplica: true },
      { texto: "Atendimento no caixa?", peso: 4, criticidade: "MEDIA", naoSeAplica: true },
    ],
  },
  {
    nome: "Banheiros",
    peso: 10,
    perguntas: [
      // peso efetivo da limpeza (10% × 7/14 = 5,0%) fica ACIMA da oferta de
      // troca de óleo (20% × 3/15 = 4,0%) — diretriz da rede
      { texto: "Limpeza geral dos banheiros?", peso: 7, criticidade: "ALTA" },
      { texto: "Papel higiênico, sabonete e papel-toalha disponíveis?", peso: 4, criticidade: "MEDIA" },
      { texto: "Conservação (portas, torneiras, descargas)?", peso: 3, criticidade: "BAIXA" },
    ],
  },
  {
    nome: "Imagem do Posto",
    peso: 5,
    perguntas: [
      { texto: "Limpeza externa, fachada e jardins?", peso: 3, criticidade: "BAIXA" },
      { texto: "Comunicação visual e painel de preços legíveis?", peso: 2, criticidade: "MEDIA" },
      { texto: "Iluminação adequada?", peso: 2, criticidade: "MEDIA" },
      // requisito: a visita não é concluída sem a foto da fachada
      { texto: "Registre uma foto geral da fachada", tipo: "FOTO", peso: 0, criticidade: "BAIXA", obrigatoria: true },
    ],
  },
];

async function main() {
  const existente = await prisma.questionario.findFirst({
    where: { nome: NOME },
  });
  if (existente) {
    // Correção pontual (jul/2026): a foto da fachada passou a ser requisito.
    // Mudar "obrigatoria" não altera snapshots/histórico — só a validação
    // de envios futuros —, então é seguro ajustar o questionário existente.
    const corrigidas = await prisma.pergunta.updateMany({
      where: {
        bloco: { questionarioId: existente.id },
        tipo: "FOTO",
        obrigatoria: false,
      },
      data: { obrigatoria: true },
    });
    console.log(
      `[questionario-oficial] "${NOME}" já existe (v${existente.versao})` +
        (corrigidas.count > 0
          ? ` — ${corrigidas.count} pergunta(s) FOTO marcada(s) como requisito.`
          : " — nada a fazer."),
    );
    return;
  }

  await prisma.questionario.create({
    data: {
      nome: NOME,
      descricao:
        "Roteiro oficial de cliente oculto da rede — avaliação por estrelas, score ponderado por bloco e criticidade.",
      status: "ATIVO",
      penalidadeCriticaTipo: "TETO",
      penalidadeCriticaValor: 74,
      blocos: {
        create: BLOCOS.map((b, bi) => ({
          nome: b.nome,
          peso: b.peso,
          ordem: bi,
          perguntas: {
            create: b.perguntas.map((p, pi) => ({
              texto: p.texto,
              tipo: p.tipo ?? "NOTA_1_5",
              peso: p.peso,
              criticidade: p.criticidade,
              obrigatoria: p.obrigatoria ?? (p.tipo ?? "NOTA_1_5") === "NOTA_1_5",
              permiteNaoSeAplica: p.naoSeAplica ?? false,
              notaMaxima:
                (p.tipo ?? "NOTA_1_5") === "NOTA_1_5" ? 5 : p.tipo === "SIM_NAO" ? 1 : 0,
              ordem: pi,
            })),
          },
        })),
      },
    },
  });
  console.log(`[questionario-oficial] "${NOME}" criado com ${BLOCOS.length} blocos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
