"use client";

import { useEffect } from "react";

/**
 * Modal padrão do sistema — todo formulário de preenchimento/edição abre
 * num modal centralizado (padrão "onepage": a lista fica na página, o
 * preenchimento em sobreposição).
 */
export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largura = "max-w-2xl",
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onFechar}
        aria-hidden
      />
      <div
        className={`relative max-h-[90vh] w-full ${largura} overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Fecha o modal automaticamente quando a server action retorna ok. */
export function useFecharAoSalvar(
  ok: boolean | undefined,
  fechar: () => void,
) {
  useEffect(() => {
    if (ok) fechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
}
