"use client";

import { useActionState } from "react";
import { trocarMinhaSenha, type SenhaState } from "@/actions/auth";
import { btnPrimario, inputCls } from "@/components/ui";

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState<SenhaState, FormData>(
    trocarMinhaSenha,
    {},
  );

  return (
    <form action={action} className="max-w-md space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Senha atual *</span>
        <input
          name="atual"
          type="password"
          required
          autoComplete="current-password"
          className={`mt-1 ${inputCls}`}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Nova senha *</span>
        <input
          name="nova"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={`mt-1 ${inputCls}`}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Confirmar nova senha *</span>
        <input
          name="confirma"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={`mt-1 ${inputCls}`}
        />
      </label>
      {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
      {state.ok && (
        <p className="text-sm text-emerald-600">Senha alterada com sucesso.</p>
      )}
      <button type="submit" disabled={pending} className={btnPrimario}>
        {pending ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}
