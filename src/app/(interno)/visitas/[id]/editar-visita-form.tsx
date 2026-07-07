"use client";

import { useActionState } from "react";
import { redefinirDataVisita, type VisitaState } from "@/actions/visitas";
import { btnSecundario, inputCls } from "@/components/ui";

/**
 * Reagenda a visita: altera a data prevista e, opcionalmente, estende a
 * validade do link ativo. Não gera novo link — o mesmo segue válido para
 * recompartilhar.
 */
export function EditarVisitaForm({
  visitaId,
  dataAtual,
  linkAtivo,
}: {
  visitaId: string;
  dataAtual: string; // yyyy-mm-dd
  linkAtivo: boolean;
}) {
  const [state, action, pending] = useActionState<VisitaState, FormData>(
    redefinirDataVisita,
    {},
  );

  return (
    <details className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        Reagendar / redefinir data
      </summary>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="visitaId" value={visitaId} />
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Nova data prevista</span>
          <input
            name="dataAgendada"
            type="date"
            defaultValue={dataAtual}
            required
            className={`mt-1 ${inputCls}`}
          />
        </label>
        {linkAtivo && (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Estender validade (dias, opcional)
            </span>
            <input
              name="validadeDias"
              type="number"
              min={1}
              max={90}
              placeholder="manter"
              className={`mt-1 ${inputCls} w-40`}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar nova data"}
        </button>
        {state.erro && <p className="w-full text-sm text-red-600">{state.erro}</p>}
        {state.ok && (
          <p className="w-full text-sm text-emerald-700">
            Data atualizada com sucesso.
          </p>
        )}
      </form>
    </details>
  );
}
