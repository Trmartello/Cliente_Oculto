"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Exibe o link do avaliador com botão de copiar e QR code.
 * O link só está disponível no momento da geração (o banco guarda apenas
 * o hash do token), por isso este componente orienta a copiá-lo agora.
 */
export function LinkAvaliacao({ link }: { link: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then(setQr);
  }, [link]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (http sem TLS) — o usuário copia manualmente
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">
        Link do avaliador gerado — copie agora
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        Por segurança este link não poderá ser visualizado novamente. Envie ao
        cliente oculto (o preenchimento é feito pelo celular).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="max-w-full break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-800">
          {link}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code do link de avaliação" className="mt-3 rounded-lg bg-white p-2" />
      )}
    </div>
  );
}
