import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { podeAdministrar } from "@/lib/rbac";
import { logout } from "@/actions/auth";

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  CONTROLADORIA: "Controladoria",
  GESTOR_REGIONAL: "Gestor Regional",
  GERENTE: "Gerente",
  CONSULTA: "Consulta",
};

export default async function InternoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();
  const admin = podeAdministrar(sessao);

  const links = [
    { href: "/dashboard", rotulo: "Dashboard" },
    { href: "/visitas", rotulo: "Visitas" },
    { href: "/nao-conformidades", rotulo: "Não Conformidades" },
    ...(admin ? [{ href: "/nps", rotulo: "NPS" }] : []),
    ...(admin
      ? [
          { href: "/cadastros/postos", rotulo: "Postos" },
          { href: "/cadastros/questionarios", rotulo: "Questionários" },
          { href: "/cadastros/avaliadores", rotulo: "Avaliadores" },
          { href: "/cadastros/usuarios", rotulo: "Usuários" },
          { href: "/cadastros/metas", rotulo: "Metas" },
          { href: "/cadastros/ciclos", rotulo: "Ciclos" },
        ]
      : []),
    { href: "/relatorios", rotulo: "Relatórios" },
    ...(sessao.papel === "ADMIN"
      ? [{ href: "/cadastros/auditoria", rotulo: "Auditoria" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-blue-700">
            Cliente Oculto
          </Link>
          <nav className="order-last flex w-full flex-wrap gap-x-4 gap-y-1 text-sm md:order-none md:w-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {l.rotulo}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {sessao.nome} · {ROTULO_PAPEL[sessao.papel]}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-600 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
