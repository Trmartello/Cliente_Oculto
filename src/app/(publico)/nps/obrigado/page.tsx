export const metadata = { title: "Obrigado! — Pesquisa de satisfação" };

export default function NpsObrigadoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Obrigado pela sua opinião!
      </h1>
      <p className="mt-2 max-w-sm text-slate-600">
        Sua resposta foi registrada e ajuda o posto a melhorar o atendimento.
        Você já pode fechar esta página.
      </p>
    </main>
  );
}
