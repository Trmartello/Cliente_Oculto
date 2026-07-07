"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarNC, criarAcao } from "@/actions/ncs";
import type { ActionState } from "@/actions/cadastros";
import { btnPrimario, btnSecundario, inputCls } from "@/components/ui";
import { Modal, useFecharAoSalvar } from "@/components/modal";

export function NcEditarForm({
  nc,
  usuarios,
}: {
  nc: {
    id: string;
    prioridade: string;
    status: string;
    responsavelId: string;
    prazo: string;
  };
  usuarios: { id: string; nome: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    atualizarNC,
    {},
  );

  return (
    <form action={action} className="grid gap-4 md:grid-cols-5">
      <input type="hidden" name="id" value={nc.id} />
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Status</span>
        <select
          name="status"
          defaultValue={nc.status}
          className={`mt-1 ${inputCls}`}
        >
          <option value="ABERTA">Aberta</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="RESOLVIDA">Resolvida</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Prioridade</span>
        <select
          name="prioridade"
          defaultValue={nc.prioridade}
          className={`mt-1 ${inputCls}`}
        >
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Responsável</span>
        <select
          name="responsavelId"
          defaultValue={nc.responsavelId}
          className={`mt-1 ${inputCls}`}
        >
          <option value="">Sem responsável</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Prazo</span>
        <input
          name="prazo"
          type="date"
          defaultValue={nc.prazo}
          className={`mt-1 ${inputCls}`}
        />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={btnPrimario}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {state.erro && (
        <p className="text-sm text-red-600 md:col-span-5">{state.erro}</p>
      )}
      {state.ok && (
        <p className="text-sm text-emerald-600 md:col-span-5">
          Tratamento atualizado.
        </p>
      )}
    </form>
  );
}

export function AcaoNovaForm({
  naoConformidadeId,
  usuarios,
}: {
  naoConformidadeId: string;
  usuarios: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    criarAcao,
    {},
  );
  useFecharAoSalvar(state.ok, () => setAberto(false));

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSecundario}>
        + Nova ação corretiva
      </button>
      <Modal
        aberto={aberto}
        titulo="Nova ação corretiva"
        onFechar={() => setAberto(false)}
      >
      <form action={action} className="grid gap-4 sm:grid-cols-3">
        <input
          type="hidden"
          name="naoConformidadeId"
          value={naoConformidadeId}
        />
        <label className="block text-sm sm:col-span-3">
          <span className="font-medium text-slate-700">Ação corretiva *</span>
          <input
            name="descricao"
            required
            placeholder="ex.: Reforçar treinamento de confirmação de combustível com a equipe"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Responsável</span>
          <select name="responsavelId" className={`mt-1 ${inputCls}`}>
            <option value="">Sem responsável</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Prazo</span>
          <input name="prazo" type="date" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Prioridade</span>
          <select
            name="prioridade"
            defaultValue="MEDIA"
            className={`mt-1 ${inputCls}`}
          >
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </label>
        {state.erro && (
          <p className="text-sm text-red-600 sm:col-span-3">{state.erro}</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-3">
          <button type="button" onClick={() => setAberto(false)} className={btnSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={btnPrimario}>
            {pending ? "Criando…" : "Adicionar ação"}
          </button>
        </div>
      </form>
      </Modal>
    </>
  );
}

export function FotoCorrecao({ acaoId }: { acaoId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("acaoId", acaoId);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro ?? "Falha no envio");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio da foto");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className={btnSecundario}
      >
        {enviando ? "Enviando…" : "📷 Foto da correção"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
        }}
      />
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
