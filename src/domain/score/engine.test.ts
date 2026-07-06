import { describe, expect, it } from "vitest";
import { calcularScore } from "./engine";
import { faixaIgeo } from "./igeo";
import type {
  BlocoConfig,
  PerguntaConfig,
  QuestionarioConfig,
  RespostaInput,
} from "./tipos";

let seq = 0;
function pergunta(overrides: Partial<PerguntaConfig> = {}): PerguntaConfig {
  seq += 1;
  return {
    id: `p${seq}`,
    texto: `Pergunta ${seq}`,
    tipo: "SIM_NAO",
    peso: 10,
    criticidade: "MEDIA",
    obrigatoria: true,
    permiteNaoSeAplica: false,
    notaMaxima: 1,
    ...overrides,
  };
}

function bloco(
  nome: string,
  peso: number,
  perguntas: PerguntaConfig[],
): BlocoConfig {
  return { id: `b-${nome}`, nome, peso, perguntas };
}

function config(
  blocos: BlocoConfig[],
  overrides: Partial<QuestionarioConfig> = {},
): QuestionarioConfig {
  return {
    blocos,
    penalidadeCriticaTipo: "NENHUMA",
    penalidadeCriticaValor: 0,
    ...overrides,
  };
}

describe("calcularScore — básico", () => {
  it("avaliação perfeita resulta em 100 e faixa Excelência", () => {
    const p1 = pergunta();
    const p2 = pergunta({ tipo: "NOTA_1_5", notaMaxima: 5 });
    const cfg = config([bloco("A", 60, [p1]), bloco("B", 40, [p2])]);
    const r = calcularScore(cfg, [
      { perguntaId: p1.id, valor: "SIM" },
      { perguntaId: p2.id, valor: "5" },
    ]);
    expect(r.scoreFinal).toBe(100);
    expect(r.faixaIgeo).toBe("EXCELENCIA");
    expect(r.temFalhaCritica).toBe(false);
    expect(r.ncsACriar).toHaveLength(0);
  });

  it("pondera perguntas e blocos pelos pesos", () => {
    // Bloco A (peso 60): SIM (peso 30) + NAO (peso 10) => 30/40 = 75
    // Bloco B (peso 40): nota 3/5 => 60
    // Final: 75*0.6 + 60*0.4 = 69
    const p1 = pergunta({ peso: 30 });
    const p2 = pergunta({ peso: 10 });
    const p3 = pergunta({ tipo: "NOTA_1_5", notaMaxima: 5, peso: 10 });
    const cfg = config([bloco("A", 60, [p1, p2]), bloco("B", 40, [p3])]);
    const r = calcularScore(cfg, [
      { perguntaId: p1.id, valor: "SIM" },
      { perguntaId: p2.id, valor: "NAO" },
      { perguntaId: p3.id, valor: "3" },
    ]);
    expect(r.porBloco.find((b) => b.nome === "A")?.score).toBe(75);
    expect(r.porBloco.find((b) => b.nome === "B")?.score).toBe(60);
    expect(r.scoreFinal).toBe(69);
  });

  it("cada tipo de pergunta pontua corretamente", () => {
    const sim = pergunta({ tipo: "SIM_NAO", notaMaxima: 1 });
    const atende = pergunta({ tipo: "ATENDE_NAO_ATENDE", notaMaxima: 1 });
    const n5 = pergunta({ tipo: "NOTA_1_5", notaMaxima: 5 });
    const n10 = pergunta({ tipo: "NOTA_1_10", notaMaxima: 10 });
    const texto = pergunta({ tipo: "TEXTO" });
    const foto = pergunta({ tipo: "FOTO" });
    const cfg = config([bloco("A", 100, [sim, atende, n5, n10, texto, foto])]);
    const r = calcularScore(cfg, [
      { perguntaId: sim.id, valor: "NAO" }, // 0
      { perguntaId: atende.id, valor: "ATENDE" }, // 100
      { perguntaId: n5.id, valor: "4" }, // 80
      { perguntaId: n10.id, valor: "7" }, // 70
      { perguntaId: texto.id, valor: "obs livre" },
      { perguntaId: foto.id, valor: null },
    ]);
    // pesos iguais entre as 4 pontuáveis: (0+100+80+70)/4 = 62.5
    expect(r.scoreFinal).toBe(62.5);
    const informativas = r.porPergunta.filter(
      (p) => p.tipo === "TEXTO" || p.tipo === "FOTO",
    );
    expect(informativas.every((p) => !p.pontua)).toBe(true);
  });
});

describe("calcularScore — normalização de pesos", () => {
  it("pesos de blocos que não somam 100 são normalizados", () => {
    const p1 = pergunta();
    const p2 = pergunta();
    // Pesos 60 + 30 = 90 → normalizados para 2/3 e 1/3
    const cfg = config([bloco("A", 60, [p1]), bloco("B", 30, [p2])]);
    const r = calcularScore(cfg, [
      { perguntaId: p1.id, valor: "SIM" },
      { perguntaId: p2.id, valor: "NAO" },
    ]);
    expect(r.scoreFinal).toBeCloseTo(66.67, 1);
  });

  it("pergunta N/A é excluída e o restante do bloco é renormalizado", () => {
    const p1 = pergunta({ peso: 50, permiteNaoSeAplica: true });
    const p2 = pergunta({ peso: 50 });
    const cfg = config([bloco("A", 100, [p1, p2])]);
    const r = calcularScore(cfg, [
      { perguntaId: p1.id, valor: null, naoSeAplica: true },
      { perguntaId: p2.id, valor: "SIM" },
    ]);
    expect(r.scoreFinal).toBe(100);
  });

  it("bloco inteiro N/A é excluído e os demais blocos renormalizados", () => {
    const p1 = pergunta({ permiteNaoSeAplica: true });
    const p2 = pergunta();
    const p3 = pergunta();
    const cfg = config([
      bloco("Banheiros", 10, [p1]),
      bloco("A", 60, [p2]),
      bloco("B", 30, [p3]),
    ]);
    const r = calcularScore(cfg, [
      { perguntaId: p1.id, valor: null, naoSeAplica: true },
      { perguntaId: p2.id, valor: "SIM" },
      { perguntaId: p3.id, valor: "NAO" },
    ]);
    const banheiros = r.porBloco.find((b) => b.nome === "Banheiros");
    expect(banheiros?.pontua).toBe(false);
    expect(banheiros?.score).toBeNull();
    // 60/90 * 100 + 30/90 * 0 = 66.67
    expect(r.scoreFinal).toBeCloseTo(66.67, 1);
  });

  it("nenhuma pergunta pontuável => score nulo", () => {
    const p1 = pergunta({ tipo: "TEXTO" });
    const cfg = config([bloco("A", 100, [p1])]);
    const r = calcularScore(cfg, [{ perguntaId: p1.id, valor: "obs" }]);
    expect(r.scoreFinal).toBeNull();
    expect(r.faixaIgeo).toBeNull();
    expect(r.matriz.pontos).toHaveLength(0);
  });
});

describe("calcularScore — falha crítica e penalidades", () => {
  const montar = (
    tipo: QuestionarioConfig["penalidadeCriticaTipo"],
    valor: number,
  ) => {
    const critica = pergunta({ criticidade: "CRITICA", peso: 10 });
    const outras = [pergunta(), pergunta(), pergunta()];
    const cfg = config(
      [bloco("Seguranca", 50, [critica, ...outras.slice(0, 1)]), bloco("A", 50, outras.slice(1))],
      { penalidadeCriticaTipo: tipo, penalidadeCriticaValor: valor },
    );
    const respostas: RespostaInput[] = [
      { perguntaId: critica.id, valor: "NAO" },
      ...outras.map((p) => ({ perguntaId: p.id, valor: "SIM" })),
    ];
    return calcularScore(cfg, respostas);
  };

  it("TETO limita o score final ao valor parametrizado", () => {
    const r = montar("TETO", 74);
    expect(r.scoreBruto).toBe(75); // 50*0.5 + 100*0.5
    expect(r.scoreFinal).toBe(74);
    expect(r.faixaIgeo).toBe("CRITICO");
    expect(r.temFalhaCritica).toBe(true);
  });

  it("TETO não altera score que já está abaixo do teto", () => {
    const critica = pergunta({ criticidade: "CRITICA" });
    const cfg = config([bloco("A", 100, [critica])], {
      penalidadeCriticaTipo: "TETO",
      penalidadeCriticaValor: 74,
    });
    const r = calcularScore(cfg, [{ perguntaId: critica.id, valor: "NAO" }]);
    expect(r.scoreFinal).toBe(0);
  });

  it("PERCENTUAL reduz o score final na proporção parametrizada", () => {
    const r = montar("PERCENTUAL", 20);
    expect(r.scoreBruto).toBe(75);
    expect(r.scoreFinal).toBe(60); // 75 * 0.8
  });

  it("NENHUMA mantém o score mas ainda gera NC", () => {
    const r = montar("NENHUMA", 0);
    expect(r.scoreFinal).toBe(75);
    expect(r.ncsACriar).toHaveLength(1);
    expect(r.ncsACriar[0].origem).toBe("FALHA_CRITICA");
    expect(r.ncsACriar[0].prioridade).toBe("URGENTE");
  });

  it("nota baixa em pergunta CRITICA de escala também reprova (limiar 40%)", () => {
    const critica = pergunta({
      tipo: "NOTA_1_5",
      notaMaxima: 5,
      criticidade: "CRITICA",
    });
    const outra = pergunta();
    const cfg = config([bloco("A", 100, [critica, outra])], {
      penalidadeCriticaTipo: "TETO",
      penalidadeCriticaValor: 74,
    });
    const r = calcularScore(cfg, [
      { perguntaId: critica.id, valor: "2" }, // 2/5 = 40% <= limiar
      { perguntaId: outra.id, valor: "SIM" },
    ]);
    expect(r.temFalhaCritica).toBe(true);
    const r2 = calcularScore(cfg, [
      { perguntaId: critica.id, valor: "3" }, // 60% > limiar
      { perguntaId: outra.id, valor: "SIM" },
    ]);
    expect(r2.temFalhaCritica).toBe(false);
  });

  it("pergunta não crítica reprovada não gera falha crítica", () => {
    const p1 = pergunta({ criticidade: "ALTA" });
    const cfg = config([bloco("A", 100, [p1])]);
    const r = calcularScore(cfg, [{ perguntaId: p1.id, valor: "NAO" }]);
    expect(r.temFalhaCritica).toBe(false);
    expect(r.ncsACriar).toHaveLength(0);
  });
});

describe("calcularScore — meta", () => {
  it("score abaixo da meta gera NC de origem SCORE_ABAIXO_META", () => {
    const p1 = pergunta({ tipo: "NOTA_1_10", notaMaxima: 10 });
    const cfg = config([bloco("A", 100, [p1])], { metaScoreMinimo: 90 });
    const r = calcularScore(cfg, [{ perguntaId: p1.id, valor: "8" }]);
    expect(r.scoreFinal).toBe(80);
    expect(r.ncsACriar).toHaveLength(1);
    expect(r.ncsACriar[0].origem).toBe("SCORE_ABAIXO_META");
  });

  it("score igual ou acima da meta não gera NC", () => {
    const p1 = pergunta({ tipo: "NOTA_1_10", notaMaxima: 10 });
    const cfg = config([bloco("A", 100, [p1])], { metaScoreMinimo: 80 });
    const r = calcularScore(cfg, [{ perguntaId: p1.id, valor: "8" }]);
    expect(r.ncsACriar).toHaveLength(0);
  });
});

describe("faixaIgeo — fronteiras", () => {
  it.each([
    [100, "EXCELENCIA"],
    [95, "EXCELENCIA"],
    [94.99, "MUITO_BOM"],
    [90, "MUITO_BOM"],
    [89.99, "BOM"],
    [85, "BOM"],
    [84.99, "REGULAR"],
    [75, "REGULAR"],
    [74.99, "CRITICO"],
    [0, "CRITICO"],
  ] as const)("score %s => %s", (score, faixa) => {
    expect(faixaIgeo(score)).toBe(faixa);
  });
});

describe("matriz importância × desempenho", () => {
  it("classifica prioridades estratégicas e top-3 oportunidades", () => {
    // Atendimento: peso 30, desempenho baixo (50) => prioridade estratégica
    // Segurança: peso 20, desempenho alto (100) => ok
    // Conveniência: peso 10 (abaixo da média ~20), desempenho 0 => não é
    //   prioridade estratégica, mas entra nas oportunidades
    const pa = pergunta({ tipo: "NOTA_1_10", notaMaxima: 10 });
    const ps = pergunta();
    const pc = pergunta();
    const pi = pergunta();
    const cfg = config([
      bloco("Atendimento", 30, [pa]),
      bloco("Seguranca", 20, [ps]),
      bloco("Conveniencia", 10, [pc]),
      bloco("Imagem", 20, [pi]),
    ]);
    const r = calcularScore(cfg, [
      { perguntaId: pa.id, valor: "5" }, // 50
      { perguntaId: ps.id, valor: "SIM" }, // 100
      { perguntaId: pc.id, valor: "NAO" }, // 0
      { perguntaId: pi.id, valor: "SIM" }, // 100
    ]);
    const atendimento = r.matriz.pontos.find((p) => p.nome === "Atendimento");
    expect(atendimento?.prioridadeEstrategica).toBe(true);
    const seguranca = r.matriz.pontos.find((p) => p.nome === "Seguranca");
    expect(seguranca?.prioridadeEstrategica).toBe(false);

    // impacto: Atendimento 0.375*50=18.75; Conveniencia 0.125*100=12.5
    expect(r.matriz.topOportunidades[0].nome).toBe("Atendimento");
    expect(r.matriz.topOportunidades[1].nome).toBe("Conveniencia");
    expect(r.matriz.topOportunidades.length).toBeLessThanOrEqual(3);
    expect(
      r.matriz.topOportunidades.every((o) => o.impacto > 0),
    ).toBe(true);
  });
});
