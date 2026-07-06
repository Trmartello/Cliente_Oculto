"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { salvarPosto, type ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";

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

  return (
    <details open={!!posto} className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        {posto ? `Editando: ${posto.nome}` : "+ Novo posto"}
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-4 md:grid-cols-3">
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
            <p className="text-sm text-red-600 md:col-span-3">{state.erro}</p>
          )}
          <div className="flex gap-2 md:col-span-3">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar posto"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}
