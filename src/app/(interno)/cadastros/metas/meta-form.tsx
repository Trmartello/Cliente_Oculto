"use client";

import { useActionState } from "react";
import { salvarMeta, type ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";

export function MetaForm({
  postos,
  blocos,
}: {
  postos: { id: string; nome: string }[];
  blocos: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarMeta,
    {},
  );

  return (
    <details className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        + Nova meta
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-4 md:grid-cols-5">
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
            <p className="text-sm text-red-600 md:col-span-5">{state.erro}</p>
          )}
          <div className="md:col-span-5">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar meta"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}
