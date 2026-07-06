"use client";

import { useActionState } from "react";
import { criarQuestionario } from "@/actions/questionarios";
import type { ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";

export function QuestionarioNovoForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    criarQuestionario,
    {},
  );

  return (
    <details className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        + Novo questionário
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome *</span>
            <input name="nome" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Descrição</span>
            <input name="descricao" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Penalidade por falha crítica
            </span>
            <select
              name="penalidadeCriticaTipo"
              defaultValue="TETO"
              className={`mt-1 ${inputCls}`}
            >
              <option value="TETO">Teto — limita o score final</option>
              <option value="PERCENTUAL">Percentual — reduz o score em %</option>
              <option value="NENHUMA">Nenhuma — apenas alerta e NC</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Valor da penalidade (teto ou %)
            </span>
            <input
              name="penalidadeCriticaValor"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={74}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          {state.erro && (
            <p className="text-sm text-red-600 md:col-span-2">{state.erro}</p>
          )}
          <div className="md:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Criando…" : "Criar e configurar blocos"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}
