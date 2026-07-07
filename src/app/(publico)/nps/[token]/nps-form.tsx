"use client";

import { useActionState, useState } from "react";
import { responderNps, type NpsState } from "@/actions/nps";

const COR_NOTA = (n: number) =>
  n <= 6 ? "bg-red-600" : n <= 8 ? "bg-amber-500" : "bg-emerald-600";

export function NpsForm({ token }: { token: string }) {
  const [nota, setNota] = useState<number | null>(null);
  const [state, action, pending] = useActionState<NpsState, FormData>(
    responderNps,
    {},
  );

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      {nota !== null && <input type="hidden" name="nota" value={nota} />}

      <p className="font-medium text-slate-900">
        De 0 a 10, o quanto você recomendaria este posto a um amigo ou
        familiar?
      </p>
      <div className="mt-3 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            aria-pressed={nota === n}
            className={`flex h-11 items-center justify-center rounded-lg border text-sm font-bold transition ${
              nota === n
                ? `${COR_NOTA(n)} border-transparent text-white`
                : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>Não recomendaria</span>
        <span>Com certeza recomendaria</span>
      </div>

      <label className="mt-5 block text-sm">
        <span className="font-medium text-slate-700">
          Quer contar o porquê? (opcional)
        </span>
        <textarea
          name="comentario"
          rows={3}
          maxLength={1000}
          placeholder="Conte como foi sua experiência…"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      {state.erro && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || nota === null}
        className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 text-base font-bold text-white active:bg-blue-700 disabled:opacity-40"
      >
        {pending ? "Enviando…" : "Enviar resposta"}
      </button>
    </form>
  );
}
