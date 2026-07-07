"use client";

import { useActionState, useState } from "react";
import { salvarCiclo, type ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

export function CicloForm({
  ciclo,
}: {
  ciclo: { id: string; nome: string; inicio: string; fim: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarCiclo,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        {ciclo ? "Editar" : "+ Novo ciclo"}
      </button>
      <Modal
        aberto={aberto}
        titulo={ciclo ? `Editar ciclo — ${ciclo.nome}` : "Novo ciclo de avaliação"}
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
        <form action={action} className="space-y-4">
          {ciclo && <input type="hidden" name="id" value={ciclo.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome *</span>
            <input
              name="nome"
              required
              defaultValue={ciclo?.nome}
              placeholder="ex.: 2º semestre 2026"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Início</span>
              <input
                name="inicio"
                type="date"
                defaultValue={ciclo?.inicio}
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Fim</span>
              <input
                name="fim"
                type="date"
                defaultValue={ciclo?.fim}
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={btnSecundario}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar ciclo"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
