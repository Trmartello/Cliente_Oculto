"use client";

import { btnPrimario } from "@/components/ui";

export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={btnPrimario}
    >
      🖨 Imprimir / Salvar PDF
    </button>
  );
}
