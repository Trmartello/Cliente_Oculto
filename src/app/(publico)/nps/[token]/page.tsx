import { prisma } from "@/lib/prisma";
import { NpsForm } from "./nps-form";

export const metadata = { title: "Pesquisa de satisfação" };

export default async function NpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pesquisa = await prisma.pesquisaNps.findUnique({
    where: { token },
    include: { posto: { select: { nome: true, cidade: true, uf: true } } },
  });

  if (!pesquisa || !pesquisa.ativo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Pesquisa indisponível
        </h1>
        <p className="mt-2 max-w-sm text-slate-600">
          Este link de pesquisa não está mais ativo.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        Pesquisa de satisfação
      </p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">
        {pesquisa.posto.nome} — {pesquisa.posto.cidade}/{pesquisa.posto.uf}
      </h1>
      <NpsForm token={token} />
    </main>
  );
}
