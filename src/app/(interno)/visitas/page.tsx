import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { podeAdministrar, escopoPosto, escopoVisita } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Tabela } from "@/components/ui";
import { Paginacao, paginaAtual } from "@/components/paginacao";
import {
  COR_FAIXA,
  COR_STATUS_VISITA,
  ROTULO_FAIXA,
  ROTULO_STATUS_VISITA,
  formatarData,
  formatarScore,
} from "@/lib/formato";
import { baseUrlPublica } from "@/lib/token-avaliacao";
import { VisitaNovaForm } from "./visita-nova-form";
import { CompartilharLink } from "./compartilhar-link";
import { mensagemConvite } from "./convite";
import type { Prisma, StatusVisita } from "@prisma/client";

export const metadata = { title: "Visitas — Cliente Oculto" };

const STATUS_VALIDOS = [
  "AGENDADA",
  "EM_ANDAMENTO",
  "ENVIADA",
  "EXPIRADA",
  "CANCELADA",
] as const;

const POR_PAGINA = 50;

export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; posto?: string; pagina?: string }>;
}) {
  const sessao = await exigirSessao();
  const { status, posto, pagina: paginaBruta } = await searchParams;
  const admin = podeAdministrar(sessao);
  const pagina = paginaAtual(paginaBruta);

  const where: Prisma.VisitaWhereInput = { ...escopoVisita(sessao) };
  if (status && (STATUS_VALIDOS as readonly string[]).includes(status)) {
    where.status = status as StatusVisita;
  }
  if (posto) where.postoId = posto;

  const [visitas, total, postos, questionarios, avaliadores, ciclos] = await Promise.all([
    prisma.visita.findMany({
      where,
      orderBy: { dataAgendada: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { posto: true, token: true },
    }),
    prisma.visita.count({ where }),
    // o filtro só lista postos do ALCANCE do usuário (gerente não vê os
    // nomes dos demais postos da rede)
    prisma.posto.findMany({
      where: { ativo: true, ...escopoPosto(sessao) },
      orderBy: { nome: "asc" },
    }),
    prisma.questionario.findMany({
      where: { status: "ATIVO" },
      orderBy: [{ nome: "asc" }, { versao: "desc" }],
    }),
    prisma.avaliador.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.ciclo.findMany({
      orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
      select: { id: true, nome: true },
    }),
  ]);

  // Base pública para reconstruir o link dos tokens ativos (reenvio).
  const base = await baseUrlPublica();

  return (
    <div>
      <PageHeader
        titulo="Visitas"
        descricao="Avaliações agendadas e enviadas — o avaliador acessa pelo link no celular"
      />

      {admin && (
        <div className="mb-6">
          <VisitaNovaForm
            postos={postos.map((p) => ({ id: p.id, nome: p.nome }))}
            questionarios={questionarios.map((q) => ({
              id: q.id,
              nome: `${q.nome} (v${q.versao})`,
            }))}
            avaliadores={avaliadores}
            ciclos={ciclos}
          />
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_VALIDOS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_VISITA[s]}
            </option>
          ))}
        </select>
        <select
          name="posto"
          defaultValue={posto ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os postos</option>
          {postos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      <Tabela
        cabecalhos={[
          "Posto",
          "Data prevista",
          "Avaliador",
          "Status",
          "Score",
          "IGEO",
          "Link",
        ]}
      >
        {visitas.map((v) => (
          <tr key={v.id}>
            <td className="px-4 py-3 font-medium">
              <Link
                href={`/visitas/${v.id}`}
                className="text-blue-700 hover:underline"
              >
                {v.posto.nome}
              </Link>
            </td>
            <td className="px-4 py-3">{formatarData(v.dataAgendada)}</td>
            <td className="px-4 py-3">{v.avaliadorNome ?? "—"}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Badge cor={COR_STATUS_VISITA[v.status]}>
                  {ROTULO_STATUS_VISITA[v.status]}
                </Badge>
                {v.temFalhaCritica && (
                  <Badge cor="bg-red-600 text-white">Falha crítica</Badge>
                )}
              </div>
            </td>
            <td className="px-4 py-3 font-semibold">
              {formatarScore(v.scoreFinal)}
            </td>
            <td className="px-4 py-3">
              {v.faixaIgeo ? (
                <Badge cor={COR_FAIXA[v.faixaIgeo]}>
                  {ROTULO_FAIXA[v.faixaIgeo]}
                </Badge>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">
              {v.token && v.token.status === "ATIVO" ? (
                <div className="space-y-1.5">
                  <p>válido até {formatarData(v.token.expiraEm)}</p>
                  {admin && v.token.tokenPlano && (
                    <CompartilharLink
                      variante="compacto"
                      link={`${base}/avaliar/${v.token.tokenPlano}`}
                      mensagem={mensagemConvite(
                        v.posto.nome,
                        `${base}/avaliar/${v.token.tokenPlano}`,
                      )}
                    />
                  )}
                </div>
              ) : v.token ? (
                (ROTULO_STATUS_TOKEN[v.token.status] ?? v.token.status)
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </Tabela>
      {visitas.length === 0 && (
        <Card className="mt-4">
          <p className="text-sm text-slate-600">
            Nenhuma visita encontrada com os filtros atuais.
          </p>
        </Card>
      )}
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        params={{ status, posto }}
      />
    </div>
  );
}

const ROTULO_STATUS_TOKEN: Record<string, string> = {
  ATIVO: "Ativo",
  USADO: "Usado",
  REVOGADO: "Revogado",
  EXPIRADO: "Expirado",
};
