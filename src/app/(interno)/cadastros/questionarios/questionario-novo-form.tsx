"use client";

import { useActionState, useState } from "react";
import { criarQuestionario } from "@/actions/questionarios";
import type { ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";

export function QuestionarioNovoForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    criarQuestionario,
    {},
  );

  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        + Novo questionário
      </button>
      <Modal aberto={aberto} titulo="Novo questionário" onFechar={() => setAberto(false)}>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
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
            <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Criando…" : "Criar e configurar blocos"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
