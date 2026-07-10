import Link from "next/link";

/**
 * Navegação de página para listas que crescem sem limite (GET ?pagina=N,
 * preservando os demais filtros da URL). Não renderiza nada com uma página
 * só — as listas continuam "onepage" enquanto couberem.
 */
export function Paginacao({
  total,
  pagina,
  porPagina,
  params = {},
}: {
  total: number;
  pagina: number;
  porPagina: number;
  params?: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `?${s}` : "?";
  };

  const cls =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50";

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
      aria-label="Paginação"
    >
      <p className="text-sm text-slate-500">
        Página {pagina} de {paginas} · {total} registro{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={cls}>
            ‹ Anterior
          </Link>
        ) : (
          <span className={`${cls} pointer-events-none opacity-40`}>
            ‹ Anterior
          </span>
        )}
        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={cls}>
            Próxima ›
          </Link>
        ) : (
          <span className={`${cls} pointer-events-none opacity-40`}>
            Próxima ›
          </span>
        )}
      </div>
    </nav>
  );
}

/** Normaliza o searchParam ?pagina — inválido/ausente vira 1. */
export function paginaAtual(bruto: string | undefined): number {
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
