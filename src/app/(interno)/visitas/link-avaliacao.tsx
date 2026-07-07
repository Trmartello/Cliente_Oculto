"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CompartilharLink } from "./compartilhar-link";

/**
 * Exibe o link do avaliador recém-gerado com opções de compartilhar
 * (WhatsApp/copiar) e QR code. O link também fica disponível depois, na
 * lista e no detalhe da visita, enquanto estiver ativo.
 */
export function LinkAvaliacao({
  link,
  mensagem,
}: {
  link: string;
  mensagem?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then(setQr);
  }, [link]);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">
        Link do avaliador gerado
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        Envie ao cliente oculto (o preenchimento é feito pelo celular). O link
        continua acessível nesta visita enquanto estiver ativo.
      </p>
      <div className="mt-3">
        <code className="block max-w-full break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-800">
          {link}
        </code>
      </div>
      <div className="mt-3">
        <CompartilharLink link={link} mensagem={mensagem} />
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code do link de avaliação" className="mt-3 rounded-lg bg-white p-2" />
      )}
    </div>
  );
}
