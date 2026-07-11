"use client";

import Link from "next/link";
import { useActionState } from "react";
import { solicitarResetSenha, type SenhaState } from "@/actions/auth";

export function EsqueciForm() {
  const [state, action, pending] = useActionState<SenhaState, FormData>(
    solicitarResetSenha,
    {},
  );

  if (state.ok) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Se este e-mail estiver cadastrado, enviamos um link para redefinir a
          senha. Verifique sua caixa de entrada (e o spam).
        </p>
        <Link href="/login" className="text-sm text-blue-700 hover:underline">
          ← Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-blue-700 hover:underline">
          ← Voltar para o login
        </Link>
      </p>
    </form>
  );
}
