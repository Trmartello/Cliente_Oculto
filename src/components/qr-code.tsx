"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/modal";
import { btnSecundario } from "@/components/ui";

/**
 * Botão que abre um QR code do link num modal, pronto para imprimir e deixar
 * no balcão (ex.: pesquisa NPS). `qrcode` já é dependência do projeto.
 */
export function QrLink({
  link,
  titulo = "QR code",
  legenda,
}: {
  link: string;
  titulo?: string;
  legenda?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (aberto && !qr) {
      QRCode.toDataURL(link, { width: 320, margin: 1 }).then(setQr);
    }
  }, [aberto, link, qr]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        QR
      </button>
      <Modal aberto={aberto} titulo={titulo} onFechar={() => setAberto(false)}>
        <div className="flex flex-col items-center gap-3 text-center print:gap-4">
          {legenda && (
            <p className="text-sm text-slate-600 print:text-base">{legenda}</p>
          )}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR code"
              className="rounded-lg bg-white p-2"
              width={320}
              height={320}
            />
          ) : (
            <p className="text-sm text-slate-400">Gerando QR…</p>
          )}
          <code className="max-w-full break-all text-xs text-slate-500">
            {link}
          </code>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className={btnSecundario}
            >
              🖨 Imprimir
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
