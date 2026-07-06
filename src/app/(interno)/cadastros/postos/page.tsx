import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alternarAtivoPosto } from "@/actions/cadastros";
import { Badge, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import Link from "next/link";
import { PostoForm } from "./posto-form";

export const metadata = { title: "Postos — Cliente Oculto" };

export default async function PostosPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  await exigirPapel("ADMIN", "CONTROLADORIA");
  const { editar } = await searchParams;

  const [postos, emEdicao] = await Promise.all([
    prisma.posto.findMany({ orderBy: { codigo: "asc" } }),
    editar
      ? prisma.posto.findUnique({ where: { id: editar } })
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Postos"
        descricao="Unidades da rede avaliadas pelo cliente oculto"
      />

      <div className="mb-6">
        <PostoForm
          key={emEdicao?.id ?? "novo"}
          posto={
            emEdicao
              ? {
                  id: emEdicao.id,
                  codigo: emEdicao.codigo,
                  nome: emEdicao.nome,
                  bandeira: emEdicao.bandeira ?? "",
                  endereco: emEdicao.endereco ?? "",
                  cidade: emEdicao.cidade,
                  uf: emEdicao.uf,
                  regiao: emEdicao.regiao,
                }
              : null
          }
        />
      </div>

      <Tabela
        cabecalhos={[
          "Código",
          "Nome",
          "Bandeira",
          "Cidade/UF",
          "Região",
          "Status",
          "Ações",
        ]}
      >
        {postos.map((p) => (
          <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
            <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
            <td className="px-4 py-3 font-medium">{p.nome}</td>
            <td className="px-4 py-3">{p.bandeira ?? "—"}</td>
            <td className="px-4 py-3">
              {p.cidade}/{p.uf}
            </td>
            <td className="px-4 py-3">{p.regiao}</td>
            <td className="px-4 py-3">
              <Badge
                cor={
                  p.ativo
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }
              >
                {p.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Link
                  href={`/cadastros/postos?editar=${p.id}`}
                  className={btnSecundario}
                >
                  Editar
                </Link>
                <form action={alternarAtivoPosto.bind(null, p.id)}>
                  <button type="submit" className={btnSecundario}>
                    {p.ativo ? "Desativar" : "Ativar"}
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
