import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { excluirCiclo } from "@/actions/cadastros";
import { FormConfirmar } from "@/components/confirmar";
import { Card, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import { formatarData, formatarScore } from "@/lib/formato";
import { CicloForm } from "./ciclo-form";

export const metadata = { title: "Ciclos — Cliente Oculto" };

export default async function CiclosPage() {
  await exigirPapel("ADMIN", "CONTROLADORIA");

  const ciclos = await prisma.ciclo.findMany({
    orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
    include: {
      visitas: {
        where: { status: "ENVIADA" },
        select: { scoreFinal: true },
      },
      _count: { select: { visitas: true } },
    },
  });

  return (
    <div>
      <PageHeader
        titulo="Ciclos de avaliação"
        descricao="Campanhas/rodadas (ex.: 2º semestre 2026) — agrupam visitas para comparação no dashboard"
      />

      <div className="mb-6">
        <CicloForm ciclo={null} />
      </div>

      {ciclos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum ciclo cadastrado. Crie um ciclo e selecione-o ao gerar as
            visitas da rodada — o dashboard passa a comparar os ciclos entre si.
          </p>
        </Card>
      ) : (
        <Tabela
          cabecalhos={[
            "Ciclo",
            "Período",
            "Visitas",
            "Enviadas",
            "Score médio",
            "Ações",
          ]}
        >
          {ciclos.map((c) => {
            const scores = c.visitas
              .map((v) => (v.scoreFinal === null ? null : Number(v.scoreFinal)))
              .filter((s): s is number => s !== null);
            const media =
              scores.length > 0
                ? scores.reduce((s, v) => s + v, 0) / scores.length
                : null;
            return (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {c.inicio ? formatarData(c.inicio) : "…"} —{" "}
                  {c.fim ? formatarData(c.fim) : "…"}
                </td>
                <td className="px-4 py-3">{c._count.visitas}</td>
                <td className="px-4 py-3">{c.visitas.length}</td>
                <td className="px-4 py-3 font-semibold">
                  {media !== null ? formatarScore(media) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CicloForm
                      ciclo={{
                        id: c.id,
                        nome: c.nome,
                        inicio: c.inicio?.toISOString().slice(0, 10) ?? "",
                        fim: c.fim?.toISOString().slice(0, 10) ?? "",
                      }}
                    />
                    {c._count.visitas === 0 && (
                      <FormConfirmar
                        mensagem={`Excluir o ciclo "${c.nome}"?`}
                        action={async () => {
                          "use server";
                          await excluirCiclo(c.id);
                        }}
                      >
                        <button
                          type="submit"
                          className={`${btnSecundario} text-red-600`}
                        >
                          Excluir
                        </button>
                      </FormConfirmar>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Tabela>
      )}
    </div>
  );
}
