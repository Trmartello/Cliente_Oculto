"use client";

import { useActionState, useState } from "react";
import {
  atualizarAcaoPlano,
  atualizarIniciativa,
  atualizarPlano,
  criarAcaoPlano,
  criarIniciativa,
  criarPlano,
} from "@/actions/planos";
import type { ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

// ============ PLANO (novo avulso / editar) ============

export function PlanoNovoForm({
  postos,
}: {
  postos: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    criarPlano,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        + Novo plano
      </button>
      <Modal
        aberto={aberto}
        titulo="Novo plano de ação"
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
        <form action={action} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Posto *</span>
            <select name="postoId" required className={`mt-1 ${inputCls}`}>
              <option value="">Selecione…</option>
              {postos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Problema a resolver *
            </span>
            <input
              name="problema"
              required
              placeholder="ex.: Fila no caixa nos horários de pico"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Descrição</span>
            <textarea name="descricao" rows={2} className={`mt-1 ${inputCls}`} />
          </label>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Criando…" : "Criar plano"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PlanoEditarForm({
  plano,
}: {
  plano: { id: string; problema: string; descricao: string; status: string };
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    atualizarPlano,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        Editar plano
      </button>
      <Modal
        aberto={aberto}
        titulo="Editar plano de ação"
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={plano.id} />
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Problema a resolver *
            </span>
            <input
              name="problema"
              required
              defaultValue={plano.problema}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Descrição</span>
            <textarea
              name="descricao"
              rows={2}
              defaultValue={plano.descricao}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={plano.status}
              className={`mt-1 ${inputCls}`}
            >
              <option value="ABERTO">Aberto</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </label>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ============ INICIATIVA ============

export function IniciativaForm({
  planoId,
  iniciativa,
}: {
  planoId: string;
  iniciativa: {
    id: string;
    titulo: string;
    descricao: string;
    status: string;
  } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    iniciativa ? atualizarIniciativa : criarIniciativa,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        {iniciativa ? "Editar" : "+ Nova iniciativa"}
      </button>
      <Modal
        aberto={aberto}
        titulo={iniciativa ? "Editar iniciativa" : "Nova iniciativa (frente de trabalho)"}
        onFechar={() => setAberto(false)}
        largura="max-w-lg"
      >
        <form action={action} className="space-y-4">
          {iniciativa ? (
            <input type="hidden" name="id" value={iniciativa.id} />
          ) : (
            <input type="hidden" name="planoId" value={planoId} />
          )}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Título *</span>
            <input
              name="titulo"
              required
              defaultValue={iniciativa?.titulo}
              placeholder="ex.: Limpeza geral dos banheiros"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Descrição</span>
            <textarea
              name="descricao"
              rows={2}
              defaultValue={iniciativa?.descricao}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          {iniciativa && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                name="status"
                defaultValue={iniciativa.status}
                className={`mt-1 ${inputCls}`}
              >
                <option value="ABERTA">Aberta</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDA">Concluída</option>
              </select>
            </label>
          )}
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ============ AÇÃO (com o select de status semi-automático) ============

const AUTOMATICOS = ["NO_PRAZO", "ATRASADA"];

export function AcaoPlanoForm({
  iniciativaId,
  usuarios,
  acao,
}: {
  iniciativaId: string;
  usuarios: { id: string; nome: string }[];
  acao: {
    id: string;
    titulo: string;
    descricao: string;
    prioridade: string;
    status: string;
    dataLimite: string; // yyyy-mm-dd ou ""
    responsavelNome: string;
    responsavelId: string;
    progresso: number;
  } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [progresso, setProgresso] = useState(acao?.progresso ?? 0);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    acao ? atualizarAcaoPlano : criarAcaoPlano,
    {},
  );
  useFecharAoSalvar(state, () => setAberto(false));

  const statusAtual = acao?.status ?? "NO_PRAZO";
  const automatico = AUTOMATICOS.includes(statusAtual);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={acao ? "text-xs font-medium text-blue-700 underline" : btnSecundario}
      >
        {acao ? "editar" : "+ Ação"}
      </button>
      <Modal
        aberto={aberto}
        titulo={acao ? "Editar ação" : "Desdobrar nova ação"}
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="space-y-4">
          {acao ? (
            <input type="hidden" name="id" value={acao.id} />
          ) : (
            <input type="hidden" name="iniciativaId" value={iniciativaId} />
          )}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Ação *</span>
            <input
              name="titulo"
              required
              defaultValue={acao?.titulo}
              placeholder="ex.: Treinar equipe da manhã no padrão de limpeza"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Detalhes</span>
            <textarea
              name="descricao"
              rows={2}
              defaultValue={acao?.descricao}
              className={`mt-1 ${inputCls}`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Prioridade</span>
              <select
                name="prioridade"
                defaultValue={acao?.prioridade ?? "MEDIA"}
                className={`mt-1 ${inputCls}`}
              >
                <option value="URGENTE">Urgente</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Data-limite</span>
              <input
                name="dataLimite"
                type="date"
                defaultValue={acao?.dataLimite}
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Responsável (usuário)
              </span>
              <select
                name="responsavelId"
                defaultValue={acao?.responsavelId ?? ""}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">—</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                ou responsável externo
              </span>
              <input
                name="responsavelNome"
                defaultValue={acao?.responsavelNome}
                placeholder="ex.: Empresa de limpeza"
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={automatico ? "AUTO" : statusAtual}
              className={`mt-1 ${inputCls}`}
            >
              {automatico ? (
                // o automático vigente é visível mas não escolhível
                <option value="AUTO" disabled>
                  {statusAtual === "ATRASADA"
                    ? "Atrasada (automático)"
                    : "No prazo (automático)"}
                </option>
              ) : (
                // só na edição com status manual: voltar ao automático
                <option value="AUTO">
                  Retomar automático (No prazo/Atrasada)
                </option>
              )}
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
              <option disabled>──────────</option>
              <option value="PAUSADA">Pausada</option>
              <option value="AGUARDANDO_VALIDACAO">Aguardando validação</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              “No prazo” e “Atrasada” são definidos pela data-limite — o
              sistema atualiza sozinho.
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Progresso: {progresso}%
            </span>
            <input
              name="progresso"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progresso}
              onChange={(e) => setProgresso(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar ação"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
