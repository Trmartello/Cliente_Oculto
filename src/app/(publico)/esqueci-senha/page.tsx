import { EsqueciForm } from "./esqueci-form";

export const metadata = { title: "Esqueci minha senha — Cliente Oculto" };

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Redefinir senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Informe seu e-mail para receber o link de redefinição.
        </p>
        <EsqueciForm />
      </div>
    </main>
  );
}
