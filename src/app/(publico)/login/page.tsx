import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Cliente Oculto" };

export default async function LoginPage() {
  const sessao = await obterSessao();
  if (sessao) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Cliente Oculto</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestão de qualidade operacional da rede
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
