"use client";

import { useActionState, useState } from "react";
import { salvarAvaliador, type ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

export function AvaliadorForm({
  avaliador,
}: {
  avaliador: { id: string; nome: string; telefone: string; email: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarAvaliador,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        {avaliador ? "Editar" : "+ Novo avaliador"}
      </button>
      <Modal
        aberto={aberto}
        titulo={avaliador ? `Editar avaliador — ${avaliador.nome}` : "Novo avaliador"}
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
        <form action={action} className="space-y-4">
          {avaliador && <input type="hidden" name="id" value={avaliador.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome *</span>
            <input
              name="nome"
              required
              defaultValue={avaliador?.nome}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Telefone (WhatsApp)
              </span>
              <input
                name="telefone"
                defaultValue={avaliador?.telefone}
                placeholder="ex.: 11 91234-5678"
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">E-mail</span>
              <input
                name="email"
                type="email"
                defaultValue={avaliador?.email}
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
              {pending ? "Salvando…" : "Salvar avaliador"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
