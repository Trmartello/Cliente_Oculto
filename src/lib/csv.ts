import "server-only";

/**
 * Gera CSV amigável ao Excel pt-BR: separador ";", BOM UTF-8 e
 * escapes de aspas conforme RFC 4180.
 */
export function gerarCsv(cabecalhos: string[], linhas: unknown[][]): string {
  const escapar = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(escapar).join(";"))
    .join("\r\n");
  return `﻿${corpo}`;
}

export function respostaCsv(nomeArquivo: string, conteudo: string): Response {
  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
