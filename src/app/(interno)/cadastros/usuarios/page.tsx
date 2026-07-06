import Link from "next/link";
import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alternarAtivoUsuario } from "@/actions/cadastros";
import { Badge, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import { UsuarioForm } from "./usuario-form";

export const metadata = { title: "Usuários — Cliente Oculto" };

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  CONTROLADORIA: "Controladoria",
  GESTOR_REGIONAL: "Gestor Regional",
  GERENTE: "Gerente",
  CONSULTA: "Consulta",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const { editar } = await searchParams;

  const [usuarios, postos, regioes, emEdicao] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nome: "asc" },
      include: { posto: true },
    }),
    prisma.posto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.posto.findMany({
      distinct: ["regiao"],
      select: { regiao: true },
      orderBy: { regiao: "asc" },
    }),
    editar
      ? prisma.usuario.findUnique({ where: { id: editar } })
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Usuários"
        descricao="Usuários internos e seus perfis de acesso"
      />

      <div className="mb-6">
        <UsuarioForm
          key={emEdicao?.id ?? "novo"}
          postos={postos.map((p) => ({ id: p.id, nome: p.nome }))}
          regioes={regioes.map((r) => r.regiao)}
          usuario={
            emEdicao
              ? {
                  id: emEdicao.id,
                  nome: emEdicao.nome,
                  email: emEdicao.email,
                  papel: emEdicao.papel,
                  postoId: emEdicao.postoId ?? "",
                  regiao: emEdicao.regiao ?? "",
                }
              : null
          }
        />
      </div>

      <Tabela cabecalhos={["Nome", "E-mail", "Perfil", "Escopo", "Status", "Ações"]}>
        {usuarios.map((u) => (
          <tr key={u.id} className={u.ativo ? "" : "opacity-50"}>
            <td className="px-4 py-3 font-medium">{u.nome}</td>
            <td className="px-4 py-3">{u.email}</td>
            <td className="px-4 py-3">
              <Badge>{ROTULO_PAPEL[u.papel]}</Badge>
            </td>
            <td className="px-4 py-3">
              {u.papel === "GERENTE"
                ? (u.posto?.nome ?? "—")
                : u.papel === "GESTOR_REGIONAL"
                  ? (u.regiao ?? "—")
                  : "Rede toda"}
            </td>
            <td className="px-4 py-3">
              <Badge
                cor={
                  u.ativo
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }
              >
                {u.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Link
                  href={`/cadastros/usuarios?editar=${u.id}`}
                  className={btnSecundario}
                >
                  Editar
                </Link>
                <form action={alternarAtivoUsuario.bind(null, u.id)}>
                  <button type="submit" className={btnSecundario}>
                    {u.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}
