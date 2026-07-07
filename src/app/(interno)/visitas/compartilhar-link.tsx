"use client";

import { useState } from "react";

/** Ícone do WhatsApp (inline, para não depender de rede/CDN). */
function IconeWhatsApp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path d="M16.04 3.2C8.9 3.2 3.1 9 3.1 16.13c0 2.28.6 4.5 1.74 6.46L3 29.2l6.77-1.77a12.9 12.9 0 0 0 6.27 1.6h.01c7.13 0 12.93-5.8 12.93-12.93 0-3.45-1.34-6.7-3.78-9.14A12.86 12.86 0 0 0 16.04 3.2zm0 23.7h-.01a10.73 10.73 0 0 1-5.47-1.5l-.39-.23-4.02 1.05 1.07-3.92-.26-.4a10.72 10.72 0 0 1-1.64-5.72c0-5.93 4.83-10.76 10.77-10.76 2.88 0 5.58 1.12 7.61 3.16a10.7 10.7 0 0 1 3.15 7.62c0 5.93-4.83 10.76-10.77 10.76zm5.9-8.06c-.32-.16-1.91-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.22.32-.84 1.05-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.36-.5-2.6-1.6-.96-.86-1.6-1.92-1.79-2.24-.19-.32-.02-.5.14-.65.14-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.22.05-.4-.03-.56-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.55-.73-.56l-.62-.01c-.22 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.7 0 1.58 1.16 3.11 1.32 3.33.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.91-.78 2.18-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37z" />
    </svg>
  );
}

/**
 * Botões para reenviar o link do avaliador: compartilhar no WhatsApp (abre a
 * lista de contatos com a mensagem pronta) ou copiar o endereço.
 */
export function CompartilharLink({
  link,
  mensagem,
  variante = "completo",
}: {
  link: string;
  /** Texto enviado ao WhatsApp; por padrão, apenas o link. */
  mensagem?: string;
  variante?: "completo" | "compacto";
}) {
  const [copiado, setCopiado] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(mensagem ?? link)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (http sem TLS) — o usuário copia manualmente
    }
  }

  if (variante === "compacto") {
    return (
      <span className="flex items-center gap-2">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-1 text-xs font-semibold text-white hover:brightness-95"
          title="Reenviar pelo WhatsApp"
        >
          <IconeWhatsApp className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="Copiar link"
        >
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
      >
        <IconeWhatsApp />
        Compartilhar no WhatsApp
      </a>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
