import { PrismaClient, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { calcularScore } from "../src/domain/score/engine";
import type {
  QuestionarioConfig,
  RespostaInput,
} from "../src/domain/score/tipos";

const prisma = new PrismaClient();

const SENHA_DEMO = "senha123";

type PerguntaSeed = {
  texto: string;
  tipo: "SIM_NAO" | "NOTA_1_5" | "NOTA_1_10" | "ATENDE_NAO_ATENDE" | "TEXTO" | "FOTO";
  peso: number;
  criticidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  permiteNaoSeAplica?: boolean;
};

const BLOCOS_SEED: { nome: string; peso: number; perguntas: PerguntaSeed[] }[] = [
  {
    nome: "Atendimento",
    peso: 30,
    perguntas: [
      { texto: "O frentista cumprimentou o cliente?", tipo: "SIM_NAO", peso: 4, criticidade: "MEDIA" },
      { texto: "Apresentação pessoal e uniforme adequados?", tipo: "NOTA_1_5", peso: 4, criticidade: "MEDIA" },
      { texto: "Confirmou o combustível e o valor antes de abastecer?", tipo: "SIM_NAO", peso: 8, criticidade: "CRITICA" },
      { texto: "Agilidade no atendimento (tempo de espera)?", tipo: "NOTA_1_5", peso: 4, criticidade: "ALTA" },
      { texto: "Agradeceu e convidou o cliente a retornar?", tipo: "SIM_NAO", peso: 3, criticidade: "BAIXA" },
    ],
  },
  {
    nome: "Segurança",
    peso: 20,
    perguntas: [
      { texto: "Solicitou que o motor fosse desligado?", tipo: "SIM_NAO", peso: 6, criticidade: "CRITICA" },
      { texto: "Frentista utilizava EPI completo?", tipo: "SIM_NAO", peso: 5, criticidade: "ALTA" },
      { texto: "Ausência de uso de celular na pista?", tipo: "SIM_NAO", peso: 4, criticidade: "ALTA" },
      { texto: "Organização e sinalização da pista?", tipo: "NOTA_1_5", peso: 4, criticidade: "MEDIA" },
    ],
  },
  {
    nome: "Venda Consultiva",
    peso: 20,
    perguntas: [
      { texto: "Ofereceu aditivo ou produto premium?", tipo: "SIM_NAO", peso: 5, criticidade: "MEDIA" },
      { texto: "Ofereceu verificação de óleo/água?", tipo: "SIM_NAO", peso: 4, criticidade: "MEDIA" },
      { texto: "Ofereceu calibragem dos pneus?", tipo: "SIM_NAO", peso: 3, criticidade: "BAIXA" },
      { texto: "Divulgou o programa de fidelidade?", tipo: "SIM_NAO", peso: 4, criticidade: "MEDIA" },
    ],
  },
  {
    nome: "Loja de Conveniência",
    peso: 15,
    perguntas: [
      { texto: "Organização e limpeza da loja?", tipo: "NOTA_1_5", peso: 4, criticidade: "MEDIA", permiteNaoSeAplica: true },
      { texto: "Produtos com precificação visível?", tipo: "ATENDE_NAO_ATENDE", peso: 4, criticidade: "MEDIA", permiteNaoSeAplica: true },
      { texto: "Disponibilidade de produtos nas gôndolas?", tipo: "NOTA_1_5", peso: 3, criticidade: "BAIXA", permiteNaoSeAplica: true },
      { texto: "Atendimento no caixa?", tipo: "NOTA_1_5", peso: 4, criticidade: "MEDIA", permiteNaoSeAplica: true },
    ],
  },
  {
    nome: "Banheiros",
    peso: 10,
    perguntas: [
      { texto: "Limpeza geral dos banheiros?", tipo: "NOTA_1_5", peso: 4, criticidade: "ALTA" },
      { texto: "Papel higiênico e sabonete disponíveis?", tipo: "SIM_NAO", peso: 3, criticidade: "MEDIA" },
      { texto: "Conservação (portas, torneiras, descargas)?", tipo: "NOTA_1_5", peso: 3, criticidade: "BAIXA" },
    ],
  },
  {
    nome: "Imagem do Posto",
    peso: 5,
    perguntas: [
      { texto: "Limpeza externa e jardins?", tipo: "NOTA_1_5", peso: 2, criticidade: "BAIXA" },
      { texto: "Comunicação visual e painel de preços legíveis?", tipo: "SIM_NAO", peso: 2, criticidade: "MEDIA" },
      { texto: "Iluminação adequada?", tipo: "SIM_NAO", peso: 1, criticidade: "MEDIA" },
      { texto: "Registre uma foto geral da fachada", tipo: "FOTO", peso: 0, criticidade: "BAIXA" },
    ],
  },
];

function notaMaximaDe(tipo: PerguntaSeed["tipo"]): number {
  switch (tipo) {
    case "NOTA_1_5":
      return 5;
    case "NOTA_1_10":
      return 10;
    case "TEXTO":
    case "FOTO":
      return 0;
    default:
      return 1;
  }
}

async function main() {
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);

  // ---- Postos (2 regiões) ----
  const postosData = [
    { codigo: "P001", nome: "Posto Central", bandeira: "Ipiranga", cidade: "São Paulo", uf: "SP", regiao: "Sudeste", endereco: "Av. Paulista, 1000" },
    { codigo: "P002", nome: "Posto Rodovia", bandeira: "Shell", cidade: "Campinas", uf: "SP", regiao: "Sudeste", endereco: "Rod. Anhanguera, km 95" },
    { codigo: "P003", nome: "Posto Litoral", bandeira: "Vibra", cidade: "Florianópolis", uf: "SC", regiao: "Sul", endereco: "Av. Beira-Mar, 500" },
    { codigo: "P004", nome: "Posto Serra", bandeira: "Bandeira Branca", cidade: "Caxias do Sul", uf: "RS", regiao: "Sul", endereco: "RS-122, km 10" },
  ];
  const postos = [] as Awaited<ReturnType<typeof prisma.posto.create>>[];
  for (const p of postosData) {
    postos.push(
      await prisma.posto.upsert({
        where: { codigo: p.codigo },
        update: {},
        create: p,
      }),
    );
  }

  // ---- Usuários ----
  const usuarios = [
    { nome: "Administrador", email: "admin@clienteoculto.dev", papel: "ADMIN" as const },
    { nome: "Ana Controladoria", email: "controladoria@clienteoculto.dev", papel: "CONTROLADORIA" as const },
    { nome: "Gustavo Gestor Sul", email: "gestor.sul@clienteoculto.dev", papel: "GESTOR_REGIONAL" as const, regiao: "Sul" },
    { nome: "Gerente Posto Central", email: "gerente.central@clienteoculto.dev", papel: "GERENTE" as const, postoId: postos[0].id },
    { nome: "Carla Consulta", email: "consulta@clienteoculto.dev", papel: "CONSULTA" as const },
  ];
  const usuariosCriados = [] as Awaited<ReturnType<typeof prisma.usuario.create>>[];
  for (const u of usuarios) {
    usuariosCriados.push(
      await prisma.usuario.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, senhaHash },
      }),
    );
  }
  const admin = usuariosCriados[0];
  const gerenteCentral = usuariosCriados[3];

  // ---- Questionário ativo com blocos e perguntas ----
  let questionario = await prisma.questionario.findFirst({
    where: { nome: "Avaliação Padrão de Postos" },
  });
  if (!questionario) {
    questionario = await prisma.questionario.create({
      data: {
        nome: "Avaliação Padrão de Postos",
        descricao:
          "Roteiro padrão de cliente oculto para postos da rede — score ponderado por bloco e criticidade.",
        status: "ATIVO",
        penalidadeCriticaTipo: "TETO",
        penalidadeCriticaValor: 74,
        blocos: {
          create: BLOCOS_SEED.map((b, bi) => ({
            nome: b.nome,
            peso: b.peso,
            ordem: bi,
            perguntas: {
              create: b.perguntas.map((p, pi) => ({
                texto: p.texto,
                tipo: p.tipo,
                peso: p.peso,
                criticidade: p.criticidade,
                obrigatoria: p.tipo !== "FOTO" && p.tipo !== "TEXTO",
                permiteNaoSeAplica: p.permiteNaoSeAplica ?? false,
                notaMaxima: notaMaximaDe(p.tipo),
                ordem: pi,
              })),
            },
          })),
        },
      },
    });
  }

  const blocos = await prisma.bloco.findMany({
    where: { questionarioId: questionario.id },
    orderBy: { ordem: "asc" },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });

  // ---- Meta da rede ----
  const metaExistente = await prisma.meta.findFirst({
    where: { postoId: null, blocoNome: null },
  });
  if (!metaExistente) {
    await prisma.meta.create({ data: { scoreMinimo: 85 } });
  }

  // ---- Config para o motor (mesma estrutura usada pela aplicação) ----
  const config: QuestionarioConfig = {
    blocos: blocos.map((b) => ({
      id: b.id,
      nome: b.nome,
      peso: Number(b.peso),
      perguntas: b.perguntas.map((p) => ({
        id: p.id,
        texto: p.texto,
        tipo: p.tipo,
        peso: Number(p.peso),
        criticidade: p.criticidade,
        obrigatoria: p.obrigatoria,
        permiteNaoSeAplica: p.permiteNaoSeAplica,
        notaMaxima: Number(p.notaMaxima),
      })),
    })),
    penalidadeCriticaTipo: questionario.penalidadeCriticaTipo,
    penalidadeCriticaValor: Number(questionario.penalidadeCriticaValor),
    metaScoreMinimo: 85,
  };

  // Gera respostas plausíveis: `qualidade` 0-1 controla o quão bem o posto vai.
  function gerarRespostas(
    qualidade: number,
    opts: { falhaCritica?: boolean } = {},
  ): RespostaInput[] {
    const respostas: RespostaInput[] = [];
    let i = 0;
    for (const b of blocos) {
      for (const p of b.perguntas) {
        i += 1;
        if (p.tipo === "TEXTO" || p.tipo === "FOTO") continue;
        const critica = p.criticidade === "CRITICA";
        if (critica && opts.falhaCritica && p.texto.includes("combustível")) {
          respostas.push({ perguntaId: p.id, valor: "NAO" });
          continue;
        }
        // Determinístico: alterna acertos conforme a "qualidade".
        const acerta = critica || (i % 10) / 10 < qualidade;
        if (p.tipo === "SIM_NAO") {
          respostas.push({ perguntaId: p.id, valor: acerta ? "SIM" : "NAO" });
        } else if (p.tipo === "ATENDE_NAO_ATENDE") {
          respostas.push({ perguntaId: p.id, valor: acerta ? "ATENDE" : "NAO_ATENDE" });
        } else {
          const max = Number(p.notaMaxima);
          const nota = acerta ? max : Math.max(1, Math.round(max * qualidade));
          respostas.push({ perguntaId: p.id, valor: String(nota) });
        }
      }
    }
    return respostas;
  }

  // ---- Visitas ENVIADAS (histórico p/ dashboard) ----
  const visitasEnviadas = await prisma.visita.count({ where: { status: "ENVIADA" } });
  if (visitasEnviadas === 0) {
    const cenarios = [
      { posto: postos[0], diasAtras: 40, qualidade: 0.9, falhaCritica: false, avaliador: "Avaliador Demo 1" },
      { posto: postos[1], diasAtras: 30, qualidade: 0.6, falhaCritica: true, avaliador: "Avaliador Demo 2" },
      { posto: postos[2], diasAtras: 20, qualidade: 0.8, falhaCritica: false, avaliador: "Avaliador Demo 1" },
      { posto: postos[0], diasAtras: 8, qualidade: 1.0, falhaCritica: false, avaliador: "Avaliador Demo 3" },
    ];

    for (const c of cenarios) {
      const respostas = gerarRespostas(c.qualidade, { falhaCritica: c.falhaCritica });
      const resultado = calcularScore(config, respostas);
      const dataEnvio = new Date(Date.now() - c.diasAtras * 24 * 60 * 60 * 1000);

      const visita = await prisma.visita.create({
        data: {
          postoId: c.posto.id,
          questionarioId: questionario.id,
          criadaPorId: admin.id,
          avaliadorNome: c.avaliador,
          dataAgendada: dataEnvio,
          status: "ENVIADA",
          dataInicio: dataEnvio,
          dataEnvio,
          scoreFinal: resultado.scoreFinal,
          scoreBruto: resultado.scoreBruto,
          faixaIgeo: resultado.faixaIgeo,
          temFalhaCritica: resultado.temFalhaCritica,
          scoresPorBloco: resultado.porBloco as unknown as Prisma.InputJsonValue,
          matrizJson: resultado.matriz as unknown as Prisma.InputJsonValue,
          token: {
            create: {
              tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
              expiraEm: dataEnvio,
              status: "USADO",
              usadoEm: dataEnvio,
            },
          },
        },
      });

      const porPergunta = new Map(resultado.porPergunta.map((r) => [r.perguntaId, r]));
      for (const r of respostas) {
        const res = porPergunta.get(r.perguntaId);
        await prisma.resposta.create({
          data: {
            visitaId: visita.id,
            perguntaId: r.perguntaId,
            valor: r.valor,
            naoSeAplica: r.naoSeAplica ?? false,
            notaObtida: res?.notaObtida ?? null,
            notaMaximaSnapshot: res?.notaMaxima ?? null,
            pesoPerguntaSnapshot: res?.peso ?? null,
            pesoBlocoSnapshot:
              resultado.porBloco.find((b) => b.blocoId === res?.blocoId)?.peso ?? null,
            criticidadeSnapshot: res?.criticidade ?? null,
            scoreItem: res?.scoreItem ?? null,
            reprovada: res?.reprovada ?? false,
          },
        });
      }

      for (const nc of resultado.ncsACriar) {
        await prisma.naoConformidade.create({
          data: {
            visitaId: visita.id,
            perguntaId: nc.perguntaId,
            origem: nc.origem,
            descricao: nc.descricao,
            prioridade: nc.prioridade,
            responsavelId: c.posto.id === postos[0].id ? gerenteCentral.id : null,
            prazo: new Date(dataEnvio.getTime() + 15 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  // ---- Visita AGENDADA com link ativo ----
  const visitaAgendada = await prisma.visita.findFirst({ where: { status: "AGENDADA" } });
  let tokenDemo: string | null = null;
  if (!visitaAgendada) {
    tokenDemo = randomBytes(32).toString("base64url");
    await prisma.visita.create({
      data: {
        postoId: postos[3].id,
        questionarioId: questionario.id,
        criadaPorId: admin.id,
        avaliadorNome: "Avaliador Demo 4",
        dataAgendada: new Date(),
        status: "AGENDADA",
        token: {
          create: {
            tokenHash: createHash("sha256").update(tokenDemo).digest("hex"),
            expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  console.log("Seed concluído.");
  console.log(`  Usuários demo (senha "${SENHA_DEMO}"):`);
  for (const u of usuarios) console.log(`   - ${u.email} (${u.papel})`);
  if (tokenDemo) {
    console.log(`  Link de avaliação demo: /avaliar/${tokenDemo}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
