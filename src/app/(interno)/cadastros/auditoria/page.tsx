import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Tabela } from "@/components/ui";
import { Paginacao, paginaAtual } from "@/components/paginacao";
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
  PlanoAcao: "Plano de Ação",
  Ciclo: "Ciclo",
  Avaliador: "Avaliador",
  PesquisaNps: "Pesquisa NPS",
};

const POR_PAGINA = 100;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidade?: string; pagina?: string }>;
}) {
  await exigirPapel("ADMIN");
  const { entidade, pagina: paginaBruta } = await searchParams;
  const pagina = paginaAtual(paginaBruta);
  const where = entidade ? { entidade } : {};

  const [registros, total, entidades] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.auditoria.count({ where }),
    prisma.auditoria.groupBy({ by: ["entidade"], _count: { _all: true } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Trilha de auditoria"
        descricao="Quem alterou o quê e quando"
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
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        params={{ entidade }}
      />
    </div>
  );
}
