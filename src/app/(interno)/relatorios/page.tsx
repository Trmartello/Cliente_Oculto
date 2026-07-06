import { exigirSessao } from "@/lib/auth";
import { escopoPosto } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, btnPrimario, inputCls } from "@/components/ui";

export const metadata = { title: "Relatórios — Cliente Oculto" };

function FiltrosRelatorio({
  action,
  rotulo,
  postos,
}: {
  action: string;
  rotulo: string;
  postos: { id: string; nome: string }[];
}) {
  return (
    <form action={action} method="get" className="grid gap-4 md:grid-cols-4">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Posto</span>
        <select name="posto" className={`mt-1 ${inputCls}`}>
          <option value="">Todos</option>
          {postos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">De</span>
        <input name="inicio" type="date" className={`mt-1 ${inputCls}`} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Até</span>
        <input name="fim" type="date" className={`mt-1 ${inputCls}`} />
      </label>
      <div className="flex items-end">
        <button type="submit" className={btnPrimario}>
          {rotulo}
        </button>
      </div>
    </form>
  );
}

export default async function RelatoriosPage() {
  const sessao = await exigirSessao();
  const postos = await prisma.posto.findMany({
    where: { ativo: true, ...escopoPosto(sessao) },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div>
      <PageHeader
        titulo="Relatórios"
        descricao="Exportações em CSV (compatível com Excel) respeitando o seu escopo de acesso"
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-semibold text-slate-900">
            Avaliações e scores
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Uma linha por avaliação enviada: scores geral e por bloco, faixa
            IGEO e indicação de falha crítica.
          </p>
          <FiltrosRelatorio
            action="/api/relatorios/avaliacoes"
            rotulo="Baixar CSV de avaliações"
            postos={postos}
          />
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold text-slate-900">
            Não conformidades
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Uma linha por não conformidade: origem, prioridade, status,
            responsável, prazos e quantidade de ações corretivas.
          </p>
          <FiltrosRelatorio
            action="/api/relatorios/ncs"
            rotulo="Baixar CSV de NCs"
            postos={postos}
          />
        </Card>
      </div>
    </div>
  );
}
