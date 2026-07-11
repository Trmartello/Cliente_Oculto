import { RedefinirForm } from "./redefinir-form";

export const metadata = { title: "Redefinir senha — Cliente Oculto" };

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Nova senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina sua nova senha de acesso.
        </p>
        <RedefinirForm token={token} />
      </div>
    </main>
  );
}
