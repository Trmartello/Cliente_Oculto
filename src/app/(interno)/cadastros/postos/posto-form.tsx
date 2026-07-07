"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarPosto, type ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";

interface PostoDados {
  id: string;
  codigo: string;
  nome: string;
  bandeira: string;
  endereco: string;
  cidade: string;
  uf: string;
  regiao: string;
}

export function PostoForm({ posto }: { posto: PostoDados | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await salvarPosto(prev, fd);
      if (r.ok) router.push("/cadastros/postos");
      return r;
    },
    {},
  );

  const [aberto, setAberto] = useState(!!posto);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        {posto ? `Editando: ${posto.nome}` : "+ Novo posto"}
      </button>
      <Modal
        aberto={aberto}
        titulo={posto ? `Editar posto — ${posto.nome}` : "Novo posto"}
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="grid gap-4 sm:grid-cols-3">
          {posto && <input type="hidden" name="id" value={posto.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Código *</span>
            <input
              name="codigo"
              required
              defaultValue={posto?.codigo}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Nome *</span>
            <input
              name="nome"
              required
              defaultValue={posto?.nome}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Bandeira</span>
            <input
              name="bandeira"
              defaultValue={posto?.bandeira}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Endereço</span>
            <input
              name="endereco"
              defaultValue={posto?.endereco}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Cidade *</span>
            <input
              name="cidade"
              required
              defaultValue={posto?.cidade}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">UF *</span>
            <input
              name="uf"
              required
              maxLength={2}
              defaultValue={posto?.uf}
              className={`mt-1 ${inputCls} uppercase`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Região *</span>
            <input
              name="regiao"
              required
              defaultValue={posto?.regiao}
              placeholder="ex.: Sudeste"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          {state.erro && (
            <p className="text-sm text-red-600 sm:col-span-3">{state.erro}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-3">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar posto"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
