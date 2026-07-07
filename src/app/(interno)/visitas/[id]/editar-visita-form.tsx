"use client";

import { useActionState, useState } from "react";
import { redefinirDataVisita, type VisitaState } from "@/actions/visitas";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

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
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<VisitaState, FormData>(
    redefinirDataVisita,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        Reagendar / redefinir data
      </button>
      <Modal
        aberto={aberto}
        titulo="Reagendar visita"
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
      <form action={action} className="flex flex-wrap items-end gap-3">
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
        <button type="submit" disabled={pending} className={btnPrimario}>
          {pending ? "Salvando…" : "Salvar nova data"}
        </button>
        {state.erro && <p className="w-full text-sm text-red-600">{state.erro}</p>}
      </form>
      </Modal>
    </>
  );
}
