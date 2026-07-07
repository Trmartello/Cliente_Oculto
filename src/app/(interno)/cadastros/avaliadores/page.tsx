import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alternarAtivoAvaliador } from "@/actions/cadastros";
import { Badge, Card, PageHeader, Tabela, btnSecundario } from "@/components/ui";
import { formatarData, formatarScore } from "@/lib/formato";
import { AvaliadorForm } from "./avaliador-form";

export const metadata = { title: "Avaliadores — Cliente Oculto" };

export default async function AvaliadoresPage() {
  await exigirPapel("ADMIN", "CONTROLADORIA");

  const avaliadores = await prisma.avaliador.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: {
      visitas: {
        where: { status: "ENVIADA" },
        select: { scoreFinal: true, dataEnvio: true },
      },
      _count: { select: { visitas: true } },
    },
  });

  return (
    <div>
      <PageHeader
        titulo="Avaliadores"
        descricao="Banco de clientes ocultos — histórico de visitas e desempenho médio entregue"
      />

      <div className="mb-6">
        <AvaliadorForm avaliador={null} />
      </div>

      {avaliadores.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum avaliador cadastrado. Cadastre para selecioná-lo ao criar
            uma visita e acompanhar o histórico aqui.
          </p>
        </Card>
      ) : (
        <Tabela
          cabecalhos={[
            "Nome",
            "Contato",
            "Visitas",
            "Enviadas",
            "Score médio entregue",
            "Última avaliação",
            "Status",
            "Ações",
          ]}
        >
          {avaliadores.map((a) => {
            const scores = a.visitas
              .map((v) => (v.scoreFinal === null ? null : Number(v.scoreFinal)))
              .filter((s): s is number => s !== null);
            const media =
              scores.length > 0
                ? scores.reduce((s, v) => s + v, 0) / scores.length
                : null;
            const ultima = a.visitas
              .map((v) => v.dataEnvio)
              .filter((d): d is Date => d !== null)
              .sort((x, y) => y.getTime() - x.getTime())[0];
            return (
              <tr key={a.id} className={a.ativo ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium">{a.nome}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {[a.telefone, a.email].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">{a._count.visitas}</td>
                <td className="px-4 py-3">{a.visitas.length}</td>
                <td className="px-4 py-3 font-semibold">
                  {media !== null ? formatarScore(media) : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {ultima ? formatarData(ultima) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    cor={
                      a.ativo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }
                  >
                    {a.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AvaliadorForm
                      avaliador={{
                        id: a.id,
                        nome: a.nome,
                        telefone: a.telefone ?? "",
                        email: a.email ?? "",
                      }}
                    />
                    <form
                      action={async () => {
                        "use server";
                        await alternarAtivoAvaliador(a.id);
                      }}
                    >
                      <button type="submit" className={btnSecundario}>
                        {a.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </form>
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
