"use client";

import Link from "next/link";
import { useActionState } from "react";
import { redefinirSenhaComToken, type SenhaState } from "@/actions/auth";

export function RedefinirForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SenhaState, FormData>(
    redefinirSenhaComToken,
    {},
  );

  if (state.ok) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Senha redefinida com sucesso. Você já pode entrar com a nova senha.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label
          htmlFor="nova"
          className="block text-sm font-medium text-slate-700"
        >
          Nova senha
        </label>
        <input
          id="nova"
          name="nova"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label
          htmlFor="confirma"
          className="block text-sm font-medium text-slate-700"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirma"
          name="confirma"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      {state.erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Redefinir senha"}
      </button>
    </form>
  );
}
