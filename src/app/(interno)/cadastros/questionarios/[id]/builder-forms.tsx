"use client";

import { useActionState, useState } from "react";
import {
  salvarBloco,
  salvarConfigQuestionario,
  salvarPergunta,
} from "@/actions/questionarios";
import type { ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

// ============ CONFIG DO QUESTIONÁRIO ============

const AJUDA_PENALIDADE: Record<string, string> = {
  TETO:
    "Se qualquer item CRÍTICO reprovar, o score final fica limitado a este valor, mesmo que o restante seja excelente. Ex.: teto 74 — um posto nota 96 que não confirmou o combustível termina com 74 (fora da meta).",
  PERCENTUAL:
    "Se qualquer item CRÍTICO reprovar, o score final é reduzido neste percentual. Ex.: 20% — um posto nota 90 termina com 72.",
  NENHUMA:
    "A falha crítica não altera o score — apenas sinaliza a visita e abre a Não Conformidade automática.",
};

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
  const [aberto, setAberto] = useState(false);
  const [tipoPenalidade, setTipoPenalidade] = useState(
    questionario.penalidadeCriticaTipo,
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarConfigQuestionario,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));

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
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        Configurações do questionário
      </button>
      <Modal
        aberto={aberto}
        titulo="Configurações do questionário"
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={questionario.id} />
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-800">
              Penalidade por falha crítica
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Falha crítica é quando um item de criticidade CRÍTICA reprova
              (nota até 40% do máximo — ex.: 1 ou 2 estrelas). Além de abrir
              Não Conformidade automática, ela pode derrubar o score da
              visita conforme a regra abaixo.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Regra</span>
                <select
                  name="penalidadeCriticaTipo"
                  value={tipoPenalidade}
                  onChange={(e) => setTipoPenalidade(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                >
                  <option value="TETO">Teto — limita o score final</option>
                  <option value="PERCENTUAL">
                    Percentual — reduz o score em %
                  </option>
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
                  disabled={tipoPenalidade === "NENHUMA"}
                  className={`mt-1 ${inputCls}`}
                />
                {tipoPenalidade === "NENHUMA" && (
                  <input
                    type="hidden"
                    name="penalidadeCriticaValor"
                    value={questionario.penalidadeCriticaValor}
                  />
                )}
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {AJUDA_PENALIDADE[tipoPenalidade]}
            </p>
          </div>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={btnSecundario}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ============ BLOCO (modal) ============

export function BlocoForm({
  questionarioId,
  bloco,
}: {
  questionarioId: string;
  bloco: { id: string; nome: string; peso: number } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarBloco,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        {bloco ? "Editar bloco" : "+ Novo bloco"}
      </button>
      <Modal
        aberto={aberto}
        titulo={bloco ? `Editar bloco — ${bloco.nome}` : "Novo bloco (etapa da visita)"}
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="questionarioId" value={questionarioId} />
          {bloco && <input type="hidden" name="id" value={bloco.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome do bloco *</span>
            <input
              name="nome"
              required
              defaultValue={bloco?.nome}
              placeholder="ex.: Atendimento"
              className={`mt-1 ${inputCls}`}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Cada bloco vira uma etapa do roteiro no celular do avaliador.
            </span>
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
              className={`mt-1 ${inputCls} w-32`}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Importância do bloco no score final — os pesos são normalizados
              pela soma (não precisam fechar 100).
            </span>
          </label>
          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={btnSecundario}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar bloco"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ============ PERGUNTA (modal) ============

const AJUDA_CRITICIDADE: Record<string, string> = {
  BAIXA: "Reprovação tem impacto pequeno — só classifica relatórios e análises.",
  MEDIA: "Impacto moderado — padrão para a maioria dos itens.",
  ALTA: "Impacto alto — destacada nas análises de conformidade.",
  CRITICA:
    "Item eliminatório: nota até 40% do máximo aplica a penalidade do questionário no score e abre Não Conformidade automática.",
};

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
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState(pergunta?.tipo ?? "NOTA_1_5");
  const [criticidade, setCriticidade] = useState(
    pergunta?.criticidade ?? "MEDIA",
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    salvarPergunta,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));
  const informativa = tipo === "TEXTO" || tipo === "FOTO";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={btnSecundario}
      >
        {pergunta ? "Editar" : "+ Nova pergunta"}
      </button>
      <Modal
        aberto={aberto}
        titulo={pergunta ? "Editar pergunta" : "Nova pergunta"}
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="blocoId" value={blocoId} />
          {pergunta && <input type="hidden" name="id" value={pergunta.id} />}

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Texto *</span>
            <textarea
              name="texto"
              required
              rows={2}
              defaultValue={pergunta?.texto}
              placeholder="ex.: Confirmou o combustível antes de abastecer?"
              className={`mt-1 ${inputCls} resize-y overflow-hidden`}
              // o campo cresce para baixo conforme o texto aumenta
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              ref={(el) => {
                if (el) el.style.height = `${el.scrollHeight}px`;
              }}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Tipo de resposta</span>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className={`mt-1 ${inputCls}`}
              >
                <option value="NOTA_1_5">Estrelas (1 a 5)</option>
                <option value="SIM_NAO">Sim / Não</option>
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
              <span className="mt-1 block text-xs text-slate-500">
                Importância do item dentro do bloco (normalizado pela soma).
              </span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Criticidade</span>
            <select
              name="criticidade"
              value={criticidade}
              onChange={(e) => setCriticidade(e.target.value)}
              className={`mt-1 ${inputCls}`}
            >
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica (eliminatória)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              {AJUDA_CRITICIDADE[criticidade]}
            </span>
          </label>

          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="obrigatoria"
                defaultChecked={pergunta?.obrigatoria ?? !informativa}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-slate-800">
                  Requisito (resposta obrigatória)
                  <span className="text-red-500"> *</span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  O item aparece com asterisco vermelho no celular e o
                  avaliador não conclui a etapa sem respondê-lo (pergunta de
                  foto exige ao menos uma foto).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="permiteNaoSeAplica"
                defaultChecked={pergunta?.permiteNaoSeAplica ?? false}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-slate-800">
                  Permite &quot;Não se aplica&quot;
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  O avaliador pode marcar que o item não existe no posto — ele
                  sai do cálculo e os pesos são redistribuídos.
                </span>
              </span>
            </label>
          </div>

          {state.erro && <p className="text-sm text-red-600">{state.erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={btnSecundario}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar pergunta"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
