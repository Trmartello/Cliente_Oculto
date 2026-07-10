import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { excluirMeta } from "@/actions/cadastros";
import { FormConfirmar } from "@/components/confirmar";
import { PageHeader, Tabela, btnPerigo } from "@/components/ui";
import { formatarData, formatarScore } from "@/lib/formato";
import { MetaForm } from "./meta-form";

export const metadata = { title: "Metas — Cliente Oculto" };

export default async function MetasPage() {
  await exigirPapel("ADMIN", "CONTROLADORIA");

  const [metas, postos, blocos] = await Promise.all([
    prisma.meta.findMany({
      include: { posto: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.posto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.bloco.findMany({
      distinct: ["nome"],
      select: { nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Metas"
        descricao="Score mínimo esperado — avaliações abaixo da meta geram Não Conformidade automática"
      />

      <div className="mb-6">
        <MetaForm
          postos={postos.map((p) => ({ id: p.id, nome: p.nome }))}
          blocos={blocos.map((b) => b.nome)}
        />
      </div>

      <Tabela
        cabecalhos={["Abrangência", "Bloco", "Score mínimo", "Vigência", "Ações"]}
      >
        {metas.map((m) => (
          <tr key={m.id}>
            <td className="px-4 py-3 font-medium">
              {m.posto?.nome ?? "Rede toda"}
            </td>
            <td className="px-4 py-3">{m.blocoNome ?? "Score geral"}</td>
            <td className="px-4 py-3 font-semibold">
              {formatarScore(m.scoreMinimo)}
            </td>
            <td className="px-4 py-3 text-slate-500">
              {m.vigenciaInicio || m.vigenciaFim
                ? `${formatarData(m.vigenciaInicio)} — ${formatarData(m.vigenciaFim)}`
                : "Sempre"}
            </td>
            <td className="px-4 py-3">
              <FormConfirmar
                action={excluirMeta.bind(null, m.id)}
                mensagem="Excluir esta meta? Avaliações futuras deixam de ser comparadas com ela."
              >
                <button type="submit" className={btnPerigo}>
                  Excluir
                </button>
              </FormConfirmar>
            </td>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}
