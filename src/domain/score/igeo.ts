import type { FaixaIgeo } from "./tipos";

// Índice Geral de Excelência Operacional — faixas de classificação.
export const FAIXAS_IGEO: { faixa: FaixaIgeo; min: number; rotulo: string }[] =
  [
    { faixa: "EXCELENCIA", min: 95, rotulo: "Excelência" },
    { faixa: "MUITO_BOM", min: 90, rotulo: "Muito Bom" },
    { faixa: "BOM", min: 85, rotulo: "Bom" },
    { faixa: "REGULAR", min: 75, rotulo: "Regular" },
    { faixa: "CRITICO", min: 0, rotulo: "Crítico" },
  ];

export function faixaIgeo(score: number): FaixaIgeo {
  for (const f of FAIXAS_IGEO) {
    if (score >= f.min) return f.faixa;
  }
  return "CRITICO";
}

export function rotuloFaixa(faixa: FaixaIgeo): string {
  return FAIXAS_IGEO.find((f) => f.faixa === faixa)?.rotulo ?? faixa;
}
