"use client";

import { useActionState, useState } from "react";
import { criarVisita, type VisitaState } from "@/actions/visitas";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";
import { LinkAvaliacao } from "./link-avaliacao";

export function VisitaNovaForm({
  postos,
  questionarios,
  avaliadores = [],
  ciclos = [],
}: {
  postos: { id: string; nome: string }[];
  questionarios: { id: string; nome: string }[];
  avaliadores?: { id: string; nome: string }[];
  ciclos?: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  // o modal permanece aberto exibindo o link gerado até o usuário dispensá-lo;
  // guardamos O LINK JÁ VISTO (não um booleano) para que, ao reabrir
  // "+ Nova visita", o formulário volte limpo em vez do link antigo
  const [linkVisto, setLinkVisto] = useState<string | null>(null);
  const [state, action, pending] = useActionState<VisitaState, FormData>(
    criarVisita,
    {},
  );
  const mostrarLink = !!state.link && state.link !== linkVisto;

  function fechar() {
    setAberto(false);
    if (state.link) setLinkVisto(state.link);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        + Nova visita
      </button>
      <Modal
        aberto={aberto || mostrarLink}
        titulo={mostrarLink ? "Link do avaliador gerado" : "Nova visita"}
        onFechar={fechar}
        largura="max-w-3xl"
      >
        {mostrarLink && state.link ? (
          <LinkAvaliacao link={state.link} />
        ) : (
          <form action={action} className="grid gap-4 sm:grid-cols-2">
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
              <span className="font-medium text-slate-700">Questionário *</span>
              <select
                name="questionarioId"
                required
                className={`mt-1 ${inputCls}`}
              >
                <option value="">Selecione…</option>
                {questionarios.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Data prevista *</span>
              <input
                name="dataAgendada"
                type="date"
                required
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Validade do link (dias) *
              </span>
              <input
                name="validadeDias"
                type="number"
                min={1}
                max={90}
                defaultValue={7}
                required
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Avaliador cadastrado
              </span>
              <select name="avaliadorId" className={`mt-1 ${inputCls}`}>
                <option value="">— nenhum —</option>
                {avaliadores.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                ou nome avulso (opcional)
              </span>
              <input name="avaliadorNome" className={`mt-1 ${inputCls}`} />
            </label>
            {ciclos.length > 0 && (
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">
                  Ciclo de avaliação (opcional)
                </span>
                <select name="cicloId" className={`mt-1 ${inputCls}`}>
                  <option value="">— sem ciclo —</option>
                  {ciclos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {state.erro && (
              <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className={btnSecundario}
              >
                Cancelar
              </button>
              <button type="submit" disabled={pending} className={btnPrimario}>
                {pending ? "Gerando…" : "Criar visita e gerar link"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
