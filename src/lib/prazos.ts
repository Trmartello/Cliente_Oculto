/**
 * Semântica ÚNICA de prazo no sistema (NCs, ações corretivas, planos de
 * ação, cron de vencidos): um prazo é uma DATA pura, gravada à meia-noite
 * UTC (`T00:00:00Z`), e só passa a "vencido" quando o dia TERMINA no fuso
 * de Brasília (America/Sao_Paulo, UTC-3 fixo desde 2019).
 *
 * Comparar prazo com `new Date()` cru faz o prazo vencer 3h mais cedo num
 * servidor UTC (Railway) — o responsável seria cobrado às 21h do próprio
 * dia do prazo. Sempre compare via `prazoVencido`/`corteVencimentoUtc`.
 *
 * Módulo puro (sem "server-only"): páginas e libs de servidor importam à
 * vontade; a exibição continua com `formatarData` (UTC forçado), que mostra
 * o dia certo justamente porque o prazo é gravado à meia-noite UTC.
 */

const FUSO_BRASILIA = "America/Sao_Paulo";

/** "YYYY-MM-DD" de hoje no fuso de Brasília. */
export function hojeEmBrasilia(): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASILIA }).format(
    new Date(),
  );
}

/**
 * Corte de vencimento: prazos ESTRITAMENTE ANTERIORES a este instante estão
 * vencidos (a data do prazo é anterior a hoje em Brasília). Um prazo "hoje"
 * ainda não venceu.
 */
export function corteVencimentoUtc(): Date {
  return new Date(`${hojeEmBrasilia()}T00:00:00Z`);
}

/** Converte o "YYYY-MM-DD" vindo de um input date em prazo persistível. */
export function dataPrazo(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

/** Prazo N dias à frente de hoje (Brasília), como data pura. */
export function prazoEmDias(dias: number): Date {
  return new Date(
    corteVencimentoUtc().getTime() + dias * 24 * 60 * 60 * 1000,
  );
}

/** true quando o dia do prazo já terminou em Brasília. */
export function prazoVencido(prazo: Date | null | undefined): boolean {
  return !!prazo && prazo < corteVencimentoUtc();
}

// ---- Bordas de PERÍODO (filtros "De/Até" e exportações) ----
// Um período pedido pelo usuário é em dias de Brasília: "Até 10/07" inclui
// o que aconteceu até 23:59:59 de 10/07 no horário de Brasília (UTC-3 fixo
// desde 2019) — não até 20:59 (T23:59:59 interpretado num servidor UTC).

/** Início do dia em Brasília, como instante UTC — borda "De" (gte). */
export function inicioDoDiaBrasilia(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

/** Fim do dia em Brasília, como instante UTC — borda "Até" inclusiva (lte). */
export function fimDoDiaBrasilia(dia: string): Date {
  return new Date(`${dia}T23:59:59.999-03:00`);
}
