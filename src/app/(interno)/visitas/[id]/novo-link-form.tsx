"use client";

import { useActionState } from "react";
import { gerarNovoLink, type VisitaState } from "@/actions/visitas";
import { btnPrimario, inputCls } from "@/components/ui";
import { LinkAvaliacao } from "../link-avaliacao";

export function NovoLinkForm({ visitaId }: { visitaId: string }) {
  const [state, action, pending] = useActionState<VisitaState, FormData>(
    gerarNovoLink,
    {},
  );

  if (state.link) {
    return <LinkAvaliacao link={state.link} />;
  }

  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="visitaId" value={visitaId} />
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Validade (dias)</span>
        <input
          name="validadeDias"
          type="number"
          min={1}
          max={90}
          defaultValue={7}
          className={`mt-1 ${inputCls} w-24`}
        />
      </label>
      <button type="submit" disabled={pending} className={btnPrimario}>
        {pending ? "Gerando…" : "Gerar novo link"}
      </button>
      {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
    </form>
  );
}
