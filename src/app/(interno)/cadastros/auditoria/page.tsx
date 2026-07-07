import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Tabela } from "@/components/ui";
import { formatarDataHora } from "@/lib/formato";

export const metadata = { title: "Auditoria — Cliente Oculto" };

const ROTULO_ENTIDADE: Record<string, string> = {
  Posto: "Posto",
  Usuario: "Usuário",
  Meta: "Meta",
  Questionario: "Questionário",
  Bloco: "Bloco",
  Pergunta: "Pergunta",
  Visita: "Visita",
  NaoConformidade: "Não Conformidade",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidade?: string }>;
}) {
  await exigirPapel("ADMIN");
  const { entidade } = await searchParams;

  const [registros, entidades] = await Promise.all([
    prisma.auditoria.findMany({
      where: entidade ? { entidade } : {},
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    prisma.auditoria.groupBy({ by: ["entidade"], _count: { _all: true } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Trilha de auditoria"
        descricao="Quem alterou o quê e quando — últimos 200 registros"
      />

      <form className="mb-4 flex items-end gap-3" method="get">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Entidade</span>
          <select
            name="entidade"
            defaultValue={entidade ?? ""}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {entidades.map((e) => (
              <option key={e.entidade} value={e.entidade}>
                {ROTULO_ENTIDADE[e.entidade] ?? e.entidade} ({e._count._all})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {registros.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum registro de auditoria ainda — as alterações administrativas
            aparecerão aqui automaticamente.
          </p>
        </Card>
      ) : (
        <Tabela cabecalhos={["Quando", "Usuário", "Entidade", "O que foi feito"]}>
          {registros.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-500">
                {formatarDataHora(r.criadoEm)}
              </td>
              <td className="px-4 py-2.5 text-sm font-medium">
                {r.usuarioNome}
              </td>
              <td className="px-4 py-2.5">
                <Badge cor="bg-slate-100 text-slate-700">
                  {ROTULO_ENTIDADE[r.entidade] ?? r.entidade}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{r.resumo}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}
