"use client";

import { useActionState } from "react";
import { criarVisita, type VisitaState } from "@/actions/visitas";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { LinkAvaliacao } from "./link-avaliacao";

export function VisitaNovaForm({
  postos,
  questionarios,
}: {
  postos: { id: string; nome: string }[];
  questionarios: { id: string; nome: string }[];
}) {
  const [state, action, pending] = useActionState<VisitaState, FormData>(
    criarVisita,
    {},
  );

  return (
    <details open={!!state.link} className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        + Nova visita
      </summary>
      <Card className="mt-3">
        {state.link ? (
          <LinkAvaliacao link={state.link} />
        ) : (
          <form action={action} className="grid gap-4 md:grid-cols-5">
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Posto *</span>
              <select name="postoId" required className={`mt-1 ${inputCls}`}>
                <option value="">Selecione…</option>
                {postos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Questionário *</span>
              <select
                name="questionarioId"
                required
                className={`mt-1 ${inputCls}`}
              >
                <option value="">Selecione…</option>
                {questionarios.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Data prevista *</span>
              <input
                name="dataAgendada"
                type="date"
                required
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-slate-700">
                Nome do avaliador (opcional)
              </span>
              <input name="avaliadorNome" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Validade do link (dias) *
              </span>
              <input
                name="validadeDias"
                type="number"
                min={1}
                max={90}
                defaultValue={7}
                required
                className={`mt-1 ${inputCls}`}
              />
            </label>
            {state.erro && (
              <p className="text-sm text-red-600 md:col-span-5">{state.erro}</p>
            )}
            <div className="md:col-span-5">
              <button type="submit" disabled={pending} className={btnPrimario}>
                {pending ? "Gerando…" : "Criar visita e gerar link"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </details>
  );
}
