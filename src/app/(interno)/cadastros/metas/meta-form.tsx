"use client";

import { useActionState, useState } from "react";
import { salvarMeta, type ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

export function MetaForm({
  postos,
  blocos,
}: {
  postos: { id: string; nome: string }[];
  blocos: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarMeta,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        + Nova meta
      </button>
      <Modal aberto={aberto} titulo="Nova meta de score" onFechar={() => setAberto(false)}>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Abrangência</span>
            <select name="postoId" className={`mt-1 ${inputCls}`}>
              <option value="">Rede toda</option>
              {postos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Bloco</span>
            <select name="blocoNome" className={`mt-1 ${inputCls}`}>
              <option value="">Score geral</option>
              {blocos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Score mínimo *</span>
            <input
              name="scoreMinimo"
              type="number"
              min={0}
              max={100}
              step="0.5"
              required
              defaultValue={85}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Início da vigência</span>
            <input name="vigenciaInicio" type="date" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Fim da vigência</span>
            <input name="vigenciaFim" type="date" className={`mt-1 ${inputCls}`} />
          </label>
          {state.erro && (
            <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar meta"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
