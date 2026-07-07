import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { baseUrlPublica } from "@/lib/token-avaliacao";
import { alternarAtivoNps, gerarLinkNps } from "@/actions/nps";
import { Badge, Card, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import { formatarDataHora } from "@/lib/formato";
import { CompartilharLink } from "../visitas/compartilhar-link";

export const metadata = { title: "NPS — Cliente Oculto" };

function classificarNps(nps: number): { rotulo: string; cor: string } {
  if (nps >= 75) return { rotulo: "Excelência", cor: "bg-emerald-100 text-emerald-800" };
  if (nps >= 50) return { rotulo: "Qualidade", cor: "bg-emerald-50 text-emerald-700" };
  if (nps >= 0) return { rotulo: "Aperfeiçoamento", cor: "bg-amber-100 text-amber-800" };
  return { rotulo: "Crítico", cor: "bg-red-100 text-red-700" };
}

function calcularNps(notas: number[]): {
  nps: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
} {
  const promotores = notas.filter((n) => n >= 9).length;
  const neutros = notas.filter((n) => n >= 7 && n <= 8).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const total = notas.length;
  return {
    nps: total === 0 ? null : Math.round(((promotores - detratores) / total) * 100),
    promotores,
    neutros,
    detratores,
  };
}

export default async function NpsInternoPage() {
  await exigirPapel("ADMIN", "CONTROLADORIA");

  const [postos, comentarios] = await Promise.all([
    prisma.posto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      include: {
        pesquisasNps: {
          include: { respostas: { select: { nota: true } } },
        },
      },
    }),
    prisma.respostaNps.findMany({
      where: { comentario: { not: null } },
      orderBy: { criadoEm: "desc" },
      take: 12,
      include: {
        pesquisa: { include: { posto: { select: { nome: true } } } },
      },
    }),
  ]);
  const base = await baseUrlPublica();

  const todasNotas = postos.flatMap((p) =>
    p.pesquisasNps.flatMap((q) => q.respostas.map((r) => r.nota)),
  );
  const rede = calcularNps(todasNotas);
  const classe = rede.nps === null ? null : classificarNps(rede.nps);

  return (
    <div>
      <PageHeader
        titulo="Pesquisa NPS"
        descricao="Link público por posto (imprima o QR no balcão) — o cliente responde de 0 a 10 sem login"
      />

      {/* NPS da rede */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            NPS da rede
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {rede.nps ?? "—"}
            </span>
            {classe && <Badge cor={classe.cor}>{classe.rotulo}</Badge>}
          </div>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Respostas
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {todasNotas.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Promotores (9-10)
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">
            {rede.promotores}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Detratores (0-6)
          </p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {rede.detratores}
          </p>
        </Card>
      </div>

      <Tabela
        cabecalhos={[
          "Posto",
          "Respostas",
          "Promotores",
          "Neutros",
          "Detratores",
          "NPS",
          "Link da pesquisa",
        ]}
      >
        {postos.map((p) => {
          const pesquisa = p.pesquisasNps[0];
          const notas = pesquisa?.respostas.map((r) => r.nota) ?? [];
          const stats = calcularNps(notas);
          const classePosto = stats.nps === null ? null : classificarNps(stats.nps);
          return (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.nome}</td>
              <td className="px-4 py-3">{notas.length}</td>
              <td className="px-4 py-3 text-emerald-700">{stats.promotores}</td>
              <td className="px-4 py-3 text-slate-500">{stats.neutros}</td>
              <td className="px-4 py-3 text-red-600">{stats.detratores}</td>
              <td className="px-4 py-3">
                {stats.nps !== null && classePosto ? (
                  <span className="flex items-center gap-2">
                    <strong>{stats.nps}</strong>
                    <Badge cor={classePosto.cor}>{classePosto.rotulo}</Badge>
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                {pesquisa && pesquisa.ativo ? (
                  <span className="flex items-center gap-2">
                    <CompartilharLink
                      link={`${base}/nps/${pesquisa.token}`}
                      mensagem={`Avalie sua experiência no ${p.nome} — leva 30 segundos: ${base}/nps/${pesquisa.token}`}
                      variante="compacto"
                    />
                    <form
                      action={async () => {
                        "use server";
                        await alternarAtivoNps(pesquisa.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-slate-400 underline hover:text-red-600"
                      >
                        desativar
                      </button>
                    </form>
                  </span>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await gerarLinkNps(p.id);
                    }}
                  >
                    <button type="submit" className={btnSecundario}>
                      {pesquisa ? "Reativar link" : "Gerar link"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          );
        })}
      </Tabela>

      {comentarios.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 font-semibold text-slate-900">
            Últimos comentários dos clientes
          </h2>
          <ul className="divide-y divide-slate-100">
            {comentarios.map((c) => (
              <li key={c.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">
                    {c.pesquisa.posto.nome}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold text-white ${
                        c.nota <= 6
                          ? "bg-red-600"
                          : c.nota <= 8
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                      }`}
                    >
                      {c.nota}
                    </span>
                    {formatarDataHora(c.criadoEm)}
                  </span>
                </div>
                <p className="mt-1 italic text-slate-600">“{c.comentario}”</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
