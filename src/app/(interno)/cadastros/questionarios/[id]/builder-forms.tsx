"use client";

import { useActionState, useState } from "react";
import {
  salvarBloco,
  salvarConfigQuestionario,
  salvarPergunta,
} from "@/actions/questionarios";
import type { ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";

// ============ CONFIG DO QUESTIONÁRIO ============

export function ConfigForm({
  questionario,
  editavel,
}: {
  questionario: {
    id: string;
    nome: string;
    descricao: string;
    penalidadeCriticaTipo: string;
    penalidadeCriticaValor: number;
  };
  editavel: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarConfigQuestionario,
    {},
  );

  if (!editavel) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Penalidade por falha crítica:{" "}
          <strong>
            {questionario.penalidadeCriticaTipo === "TETO"
              ? `teto de ${questionario.penalidadeCriticaValor}`
              : questionario.penalidadeCriticaTipo === "PERCENTUAL"
                ? `redução de ${questionario.penalidadeCriticaValor}%`
                : "nenhuma (apenas alerta e NC)"}
          </strong>
        </p>
      </Card>
    );
  }

  return (
    <details>
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        Configurações do questionário
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={questionario.id} />
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome *</span>
            <input
              name="nome"
              required
              defaultValue={questionario.nome}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Descrição</span>
            <input
              name="descricao"
              defaultValue={questionario.descricao}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Penalidade por falha crítica
            </span>
            <select
              name="penalidadeCriticaTipo"
              defaultValue={questionario.penalidadeCriticaTipo}
              className={`mt-1 ${inputCls}`}
            >
              <option value="TETO">Teto — limita o score final</option>
              <option value="PERCENTUAL">Percentual — reduz o score em %</option>
              <option value="NENHUMA">Nenhuma — apenas alerta e NC</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Valor da penalidade
            </span>
            <input
              name="penalidadeCriticaValor"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={questionario.penalidadeCriticaValor}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          {state.erro && (
            <p className="text-sm text-red-600 md:col-span-2">{state.erro}</p>
          )}
          {state.ok && (
            <p className="text-sm text-emerald-600 md:col-span-2">
              Configurações salvas.
            </p>
          )}
          <div className="md:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}

// ============ BLOCO ============

export function BlocoForm({
  questionarioId,
  bloco,
}: {
  questionarioId: string;
  bloco: { id: string; nome: string; peso: number } | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarBloco,
    {},
  );

  return (
    <details>
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        {bloco ? "Editar bloco" : "+ Novo bloco"}
      </summary>
      <Card className="mt-3">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="questionarioId" value={questionarioId} />
          {bloco && <input type="hidden" name="id" value={bloco.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome do bloco *</span>
            <input
              name="nome"
              required
              defaultValue={bloco?.nome}
              placeholder="ex.: Atendimento"
              className={`mt-1 ${inputCls} min-w-56`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Peso (%) *</span>
            <input
              name="peso"
              type="number"
              min={0.5}
              max={100}
              step="0.5"
              required
              defaultValue={bloco?.peso}
              className={`mt-1 ${inputCls} w-28`}
            />
          </label>
          <button type="submit" disabled={pending} className={btnPrimario}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
        </form>
      </Card>
    </details>
  );
}

// ============ PERGUNTA ============

export function PerguntaForm({
  blocoId,
  pergunta,
}: {
  blocoId: string;
  pergunta: {
    id: string;
    texto: string;
    tipo: string;
    peso: number;
    criticidade: string;
    obrigatoria: boolean;
    permiteNaoSeAplica: boolean;
  } | null;
}) {
  const [tipo, setTipo] = useState(pergunta?.tipo ?? "SIM_NAO");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarPergunta,
    {},
  );
  const informativa = tipo === "TEXTO" || tipo === "FOTO";

  return (
    <details>
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        {pergunta ? "Editar" : "+ Nova pergunta"}
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-3 md:grid-cols-6">
          <input type="hidden" name="blocoId" value={blocoId} />
          {pergunta && <input type="hidden" name="id" value={pergunta.id} />}
          <label className="block text-sm md:col-span-6">
            <span className="font-medium text-slate-700">Texto *</span>
            <input
              name="texto"
              required
              defaultValue={pergunta?.texto}
              placeholder="ex.: Confirmou o combustível antes de abastecer?"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Tipo de resposta</span>
            <select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={`mt-1 ${inputCls}`}
            >
              <option value="SIM_NAO">Sim / Não</option>
              <option value="NOTA_1_5">Nota 1 a 5</option>
              <option value="NOTA_1_10">Nota 1 a 10</option>
              <option value="ATENDE_NAO_ATENDE">Atende / Não Atende</option>
              <option value="TEXTO">Texto (informativa)</option>
              <option value="FOTO">Foto (informativa)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Peso</span>
            <input
              name="peso"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={pergunta?.peso ?? (informativa ? 0 : 5)}
              disabled={informativa}
              className={`mt-1 ${inputCls}`}
            />
            {informativa && <input type="hidden" name="peso" value={0} />}
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Criticidade</span>
            <select
              name="criticidade"
              defaultValue={pergunta?.criticidade ?? "MEDIA"}
              className={`mt-1 ${inputCls}`}
            >
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">
                Crítica — reprova gera NC automática
              </option>
            </select>
          </label>
          <div className="flex items-end gap-4 md:col-span-1">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="obrigatoria"
                defaultChecked={pergunta?.obrigatoria ?? !informativa}
              />
              Obrigatória
            </label>
          </div>
          <div className="flex items-center gap-4 md:col-span-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="permiteNaoSeAplica"
                defaultChecked={pergunta?.permiteNaoSeAplica ?? false}
              />
              Permite &quot;Não se aplica&quot;
            </label>
          </div>
          {state.erro && (
            <p className="text-sm text-red-600 md:col-span-6">{state.erro}</p>
          )}
          <div className="md:col-span-6">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar pergunta"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}
