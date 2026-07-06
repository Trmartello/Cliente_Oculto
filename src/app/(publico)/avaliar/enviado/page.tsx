export const metadata = { title: "Avaliação enviada — Cliente Oculto" };

export default function EnviadoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Avaliação enviada!
      </h1>
      <p className="mt-2 max-w-sm text-slate-600">
        Suas respostas foram registradas com sucesso. Obrigado pela
        participação — você já pode fechar esta página.
      </p>
    </main>
  );
}
