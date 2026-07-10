"use client";

import { useRef, useState, useTransition } from "react";
import {
  criarObservacao,
  editarObservacao,
  enviarAvaliacao,
  marcarBlocoNaoSeAplica,
  removerFotoAvaliacao,
  removerObservacao,
  salvarRascunho,
  type RespostaRascunho,
} from "@/actions/avaliacao";

interface PerguntaW {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  permiteNaoSeAplica: boolean;
}

interface BlocoW {
  id: string;
  nome: string;
  perguntas: PerguntaW[];
}

type RespostaLocal = {
  valor: string | null;
  naoSeAplica: boolean;
  comentario: string | null; // legado — o feed de observações substitui
};

/** Entrada do feed: texto e/ou fotos, na ordem em que foi criada. */
export type ObservacaoLocal = {
  id: string;
  texto: string | null;
  fotos: string[]; // ids de evidência
};

/** Estado da etapa marcada como "não se aplica" ao posto. */
export type BlocoNALocal = { naoSeAplica: boolean; comentario: string };

/** Rascunho do composer (ainda não virou observação). */
type RascunhoObs = { texto: string; fotos: string[] };

const RASCUNHO_VAZIO: RascunhoObs = { texto: "", fotos: [] };

type Tela =
  | { tipo: "hub" }
  | { tipo: "bloco"; indice: number }
  | { tipo: "revisao" };

// Recomprime a foto no aparelho antes do upload (essencial em 4G).
async function comprimirImagem(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const MAX = 1600;
    const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    return blob ?? arquivo;
  } catch {
    return arquivo;
  }
}

function BotaoOpcao({
  ativo,
  onClick,
  children,
  tom = "neutro",
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tom?: "positivo" | "negativo" | "neutro";
}) {
  const corAtivo =
    tom === "positivo"
      ? "bg-emerald-600 text-white border-emerald-600"
      : tom === "negativo"
        ? "bg-red-600 text-white border-red-600"
        : "bg-blue-600 text-white border-blue-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 flex-1 rounded-xl border px-3 py-2.5 text-base font-semibold transition ${
        ativo
          ? corAtivo
          : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

const ROTULO_NOTA_5: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

function Estrelas({
  valor,
  onChange,
}: {
  valor: number | null;
  onChange: (nota: number) => void;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const cheia = valor !== null && n <= valor;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={valor === n}
              aria-label={`${n} estrela${n > 1 ? "s" : ""} — ${ROTULO_NOTA_5[n]}`}
              onClick={() => onChange(n)}
              className="flex h-12 flex-1 items-center justify-center rounded-lg active:bg-amber-50"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-9 w-9 transition ${
                  cheia ? "fill-amber-400 stroke-amber-500" : "fill-white stroke-slate-300"
                }`}
                strokeWidth="1.5"
              >
                <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.65 1.13 6.58L12 17.57l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
              </svg>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-center text-sm font-medium text-slate-600" aria-live="polite">
        {valor !== null ? `${valor} de 5 — ${ROTULO_NOTA_5[valor]}` : "Toque nas estrelas para avaliar"}
      </p>
    </div>
  );
}

function MiniaturaFoto({
  id,
  token,
  onExcluir,
}: {
  id: string;
  token: string;
  /** Quando presente, exibe o "×" sobre a foto para excluí-la. */
  onExcluir?: () => void;
}) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/evidencia/${id}?token=${encodeURIComponent(token)}`}
        alt="Foto enviada"
        className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
      />
      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          aria-label="Excluir esta foto"
          title="Excluir esta foto"
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/85 text-sm font-bold leading-none text-white shadow active:bg-red-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Feed de observações do item + composer.
 * Cada observação pode ter só texto, texto com uma ou mais fotos, ou só
 * foto — e a lista preserva a ordem de criação.
 */
function Observacoes({
  token,
  perguntaId,
  feed,
  rascunho,
  onRascunho,
  onNovaObservacao,
  onAtualizarObservacao,
  onRemoverObservacao,
}: {
  token: string;
  perguntaId: string;
  feed: ObservacaoLocal[];
  rascunho: RascunhoObs;
  onRascunho: (r: RascunhoObs) => void;
  onNovaObservacao: (obs: ObservacaoLocal) => void;
  onAtualizarObservacao: (obs: ObservacaoLocal) => void;
  onRemoverObservacao: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // para onde vai a próxima foto: composer ou edição em andamento
  const destinoUpload = useRef<"composer" | "edicao">("composer");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // edição de uma observação já salva
  const [editando, setEditando] = useState<{
    id: string;
    texto: string;
    novasFotos: string[];
  } | null>(null);

  async function subirFoto(arquivo: File) {
    setEnviandoFoto(true);
    setErro(null);
    try {
      const blob = await comprimirImagem(arquivo);
      const fd = new FormData();
      fd.append("arquivo", blob, "foto.jpg");
      fd.append("token", token);
      fd.append("perguntaId", perguntaId);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro ?? "Falha no envio");
      if (destinoUpload.current === "edicao") {
        setEditando((e) =>
          e ? { ...e, novasFotos: [...e.novasFotos, json.id] } : e,
        );
      } else {
        onRascunho({ ...rascunho, fotos: [...rascunho.fotos, json.id] });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio da foto");
    } finally {
      setEnviandoFoto(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function pedirFoto(destino: "composer" | "edicao") {
    destinoUpload.current = destino;
    inputRef.current?.click();
  }

  async function adicionar() {
    if (!rascunho.texto.trim() && rascunho.fotos.length === 0) return;
    setSalvando(true);
    setErro(null);
    const r = await criarObservacao(
      token,
      perguntaId,
      rascunho.texto,
      rascunho.fotos,
    );
    setSalvando(false);
    if (r.erro || !r.observacao) {
      setErro(r.erro ?? "Não foi possível salvar");
      return;
    }
    onNovaObservacao(r.observacao);
    onRascunho(RASCUNHO_VAZIO);
  }

  async function remover(id: string) {
    onRemoverObservacao(id); // otimista
    await removerObservacao(token, id);
  }

  /** Rejeita uma foto do composer (ainda não faz parte de observação). */
  function excluirFotoRascunho(fid: string) {
    onRascunho({ ...rascunho, fotos: rascunho.fotos.filter((f) => f !== fid) });
    void removerFotoAvaliacao(token, fid);
  }

  /** Exclui uma foto de observação já salva (a observação some se esvaziar). */
  function excluirFotoSalva(obs: ObservacaoLocal, fid: string) {
    const restantes = obs.fotos.filter((f) => f !== fid);
    if (!obs.texto && restantes.length === 0) onRemoverObservacao(obs.id);
    else onAtualizarObservacao({ ...obs, fotos: restantes });
    void removerFotoAvaliacao(token, fid);
  }

  /** Exclui uma foto recém-tirada dentro da edição. */
  function excluirFotoEdicao(fid: string) {
    setEditando((e) =>
      e ? { ...e, novasFotos: e.novasFotos.filter((f) => f !== fid) } : e,
    );
    void removerFotoAvaliacao(token, fid);
  }

  async function salvarEdicao(obs: ObservacaoLocal) {
    if (!editando) return;
    setSalvando(true);
    setErro(null);
    const r = await editarObservacao(
      token,
      obs.id,
      editando.texto,
      editando.novasFotos,
    );
    setSalvando(false);
    if (r.erro || !r.observacao) {
      setErro(r.erro ?? "Não foi possível salvar a edição");
      return;
    }
    onAtualizarObservacao(r.observacao);
    setEditando(null);
  }

  function cancelarEdicao() {
    if (!editando) return;
    // fotos tiradas durante a edição e descartadas são apagadas
    for (const fid of editando.novasFotos) void removerFotoAvaliacao(token, fid);
    setEditando(null);
    setErro(null);
  }

  return (
    <div>
      {/* Feed na ordem de criação */}
      {feed.length > 0 && (
        <ul className="space-y-2">
          {feed.map((o, i) => {
            const emEdicao = editando?.id === o.id;
            const legado = o.id.startsWith("legado:");
            return (
              <li
                key={o.id}
                className={`rounded-xl border bg-white p-2.5 ${
                  emEdicao ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Observação {i + 1}
                  </span>
                  {!legado && !emEdicao && (
                    <span className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setEditando({
                            id: o.id,
                            texto: o.texto ?? "",
                            novasFotos: [],
                          })
                        }
                        className="text-xs text-blue-600 underline active:text-blue-800"
                        aria-label="Editar observação"
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(o.id)}
                        className="text-xs text-slate-400 underline active:text-red-600"
                        aria-label="Remover observação"
                      >
                        remover
                      </button>
                    </span>
                  )}
                </div>

                {emEdicao ? (
                  <div className="mt-1">
                    <textarea
                      value={editando.texto}
                      onChange={(e) =>
                        setEditando((ed) =>
                          ed ? { ...ed, texto: e.target.value } : ed,
                        )
                      }
                      rows={2}
                      placeholder="Comentário desta observação…"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    {(o.fotos.length > 0 || editando.novasFotos.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {o.fotos.map((fid) => (
                          <MiniaturaFoto
                            key={fid}
                            id={fid}
                            token={token}
                            onExcluir={() => excluirFotoSalva(o, fid)}
                          />
                        ))}
                        {editando.novasFotos.map((fid) => (
                          <MiniaturaFoto
                            key={fid}
                            id={fid}
                            token={token}
                            onExcluir={() => excluirFotoEdicao(fid)}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={enviandoFoto}
                        onClick={() => pedirFoto("edicao")}
                        className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
                      >
                        {enviandoFoto ? "Enviando…" : "📷 Foto"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicao}
                        disabled={salvando}
                        className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => salvarEdicao(o)}
                        disabled={salvando}
                        className="min-h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-40"
                      >
                        {salvando ? "Salvando…" : "Salvar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {o.texto && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                        {o.texto}
                      </p>
                    )}
                    {o.fotos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {o.fotos.map((fid) => (
                          <MiniaturaFoto
                            key={fid}
                            id={fid}
                            token={token}
                            onExcluir={
                              legado ? undefined : () => excluirFotoSalva(o, fid)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Composer: novo comentário e/ou fotos */}
      <div className={`${feed.length > 0 ? "mt-2" : ""} rounded-xl border border-dashed border-slate-300 bg-white p-2.5`}>
        <textarea
          value={rascunho.texto}
          onChange={(e) => onRascunho({ ...rascunho, texto: e.target.value })}
          rows={2}
          placeholder="Escreva um comentário (opcional se anexar foto)…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        {rascunho.fotos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {rascunho.fotos.map((fid) => (
              <MiniaturaFoto
                key={fid}
                id={fid}
                token={token}
                onExcluir={() => excluirFotoRascunho(fid)}
              />
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={enviandoFoto}
            onClick={() => pedirFoto("composer")}
            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
          >
            {enviandoFoto ? "Enviando…" : "📷 Foto"}
          </button>
          <button
            type="button"
            disabled={
              salvando || (!rascunho.texto.trim() && rascunho.fotos.length === 0)
            }
            onClick={adicionar}
            className="min-h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-40"
          >
            {salvando ? "Salvando…" : "Adicionar observação"}
          </button>
        </div>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subirFoto(f);
        }}
      />
    </div>
  );
}

/** Área expansível de observações sob cada item avaliado. */
function AreaObservacoes({
  sempreAberto = false,
  temConteudo,
  children,
}: {
  sempreAberto?: boolean;
  temConteudo: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(sempreAberto || temConteudo);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 active:bg-slate-50"
      >
        💬 Comentário&ensp;·&ensp;📷 Foto
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Comentários e fotos deste item
      </p>
      {children}
    </div>
  );
}

export function AvaliacaoWizard({
  token,
  posto,
  blocos,
  respostasIniciais,
  observacoesIniciais,
  blocosNAIniciais,
  jaEnviada = false,
  revisavelAte,
}: {
  token: string;
  posto: string;
  blocos: BlocoW[];
  respostasIniciais: Record<string, RespostaLocal>;
  observacoesIniciais: Record<string, ObservacaoLocal[]>;
  blocosNAIniciais: Record<string, BlocoNALocal>;
  /** Avaliação já enviada — o avaliador está revisando dentro do prazo. */
  jaEnviada?: boolean;
  /** Data-limite (formatada) para revisar/reenviar. */
  revisavelAte?: string;
}) {
  // Navegação livre: o avaliador escolhe a ordem das etapas no hub.
  const [tela, setTela] = useState<Tela>({ tipo: "hub" });
  const [respostas, setRespostas] = useState<Record<string, RespostaLocal>>(
    respostasIniciais,
  );
  const [observacoes, setObservacoes] = useState<
    Record<string, ObservacaoLocal[]>
  >(observacoesIniciais);
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoObs>>({});
  const [blocosNA, setBlocosNA] = useState<Record<string, BlocoNALocal>>(
    blocosNAIniciais,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const bloco = tela.tipo === "bloco" ? blocos[tela.indice] : null;

  function respostaDe(perguntaId: string): RespostaLocal {
    return (
      respostas[perguntaId] ?? { valor: null, naoSeAplica: false, comentario: null }
    );
  }

  function feedDe(perguntaId: string): ObservacaoLocal[] {
    return observacoes[perguntaId] ?? [];
  }

  function rascunhoDe(perguntaId: string): RascunhoObs {
    return rascunhos[perguntaId] ?? RASCUNHO_VAZIO;
  }

  function naDe(blocoId: string): BlocoNALocal {
    return blocosNA[blocoId] ?? { naoSeAplica: false, comentario: "" };
  }

  function totalFotos(perguntaId: string): number {
    return (
      feedDe(perguntaId).reduce((s, o) => s + o.fotos.length, 0) +
      rascunhoDe(perguntaId).fotos.length
    );
  }

  function atualizar(perguntaId: string, mudanca: Partial<RespostaLocal>) {
    setRespostas((atual) => ({
      ...atual,
      [perguntaId]: { ...respostaDe(perguntaId), ...mudanca },
    }));
    setErro(null);
  }

  function pendentesDo(b: BlocoW): PerguntaW[] {
    if (naDe(b.id).naoSeAplica) return []; // etapa não se aplica ao posto
    return b.perguntas.filter((p) => {
      if (!p.obrigatoria) return false;
      // requisito de foto: atendido por foto anexada OU "não se aplica"
      // (mesma regra do servidor — sem isso o envio trava para sempre)
      if (p.tipo === "FOTO")
        return !respostaDe(p.id).naoSeAplica && totalFotos(p.id) === 0;
      const r = respostaDe(p.id);
      return !r.naoSeAplica && (r.valor === null || r.valor.trim() === "");
    });
  }

  /** Etapa é dada como preenchida quando não tem pendências e foi tocada
   *  (alguma resposta/observação) — ou quando marcada como N/A. */
  function statusDo(b: BlocoW): "na" | "completa" | "pendente" {
    if (naDe(b.id).naoSeAplica) return "na";
    if (pendentesDo(b).length > 0) return "pendente";
    return "completa";
  }

  const etapasPendentes = blocos.filter((b) => statusDo(b) === "pendente");
  const etapasOk = blocos.length - etapasPendentes.length;

  function rascunhoDo(b: BlocoW): RespostaRascunho[] {
    return b.perguntas.map((p) => {
      const r = respostaDe(p.id);
      return {
        perguntaId: p.id,
        valor: r.valor,
        naoSeAplica: r.naoSeAplica,
        comentario: r.comentario,
      };
    });
  }

  /** Converte em observação qualquer rascunho de composer não vazio.
   *  Retorna false se alguma observação não pôde ser gravada. */
  async function comitarRascunhos(perguntas: PerguntaW[]): Promise<boolean> {
    let ok = true;
    for (const p of perguntas) {
      const r = rascunhoDe(p.id);
      if (!r.texto.trim() && r.fotos.length === 0) continue;
      const res = await criarObservacao(token, p.id, r.texto, r.fotos);
      if (res.observacao) {
        const obs = res.observacao;
        setObservacoes((atual) => ({
          ...atual,
          [p.id]: [...(atual[p.id] ?? []), obs],
        }));
        setRascunhos((atual) => ({ ...atual, [p.id]: RASCUNHO_VAZIO }));
      } else {
        ok = false; // mantém o rascunho na tela para nova tentativa
      }
    }
    return ok;
  }

  const ERRO_SALVAR =
    "Não foi possível salvar suas respostas (conexão instável ou link expirado). Verifique a internet e tente de novo — nada foi perdido nesta tela.";

  /** Salva a etapa e navega ao hub; em falha, PERMANECE na etapa com aviso
   *  (autosave silencioso que falha = avaliador perdendo dados sem saber). */
  function salvarESair(b: BlocoW) {
    startTransition(async () => {
      try {
        const okObs = await comitarRascunhos(b.perguntas);
        const res = await salvarRascunho(token, rascunhoDo(b));
        if (!okObs || res.erro) {
          setErro(res.erro ?? ERRO_SALVAR);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        setTela({ tipo: "hub" });
        window.scrollTo({ top: 0 });
      } catch {
        setErro(ERRO_SALVAR);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  /** Sai da etapa atual salvando tudo (sem validar) e volta ao hub. */
  function voltarAoHub() {
    if (!bloco) {
      setTela({ tipo: "hub" });
      return;
    }
    setErro(null);
    salvarESair(bloco);
  }

  /** Conclui a etapa: exige que não haja pendências e volta ao hub. */
  function concluirEtapa() {
    if (!bloco) return;
    const pendentes = pendentesDo(bloco);
    if (pendentes.length > 0) {
      setErro(`Responda: ${pendentes[0].texto}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErro(null);
    salvarESair(bloco);
  }

  /** Marca/desmarca a etapa como "não se aplica" (persiste na hora).
   *  Se a gravação falhar, desfaz o checkbox e avisa. */
  function alternarNA(b: BlocoW, naoSeAplica: boolean) {
    const atual = naDe(b.id);
    setBlocosNA((m) => ({ ...m, [b.id]: { ...atual, naoSeAplica } }));
    setErro(null);
    startTransition(async () => {
      try {
        const res = await marcarBlocoNaoSeAplica(
          token,
          b.id,
          naoSeAplica,
          atual.comentario,
        );
        if (res.erro) throw new Error(res.erro);
      } catch {
        setBlocosNA((m) => ({ ...m, [b.id]: atual })); // desfaz
        setErro(ERRO_SALVAR);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function salvarComentarioNA(b: BlocoW, comentario: string) {
    const atual = naDe(b.id);
    if (!atual.naoSeAplica) return;
    startTransition(async () => {
      try {
        const res = await marcarBlocoNaoSeAplica(token, b.id, true, comentario);
        if (res.erro) throw new Error(res.erro);
      } catch {
        setErro(ERRO_SALVAR);
      }
    });
  }

  /** GPS do aparelho no momento do envio — opcional, nunca bloqueia. */
  function capturarGeo(): Promise<
    { latitude: number; longitude: number; precisaoM: number | null } | null
  > {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      const fim = setTimeout(() => resolve(null), 6000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fim);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precisaoM: Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
          });
        },
        () => {
          clearTimeout(fim);
          resolve(null); // permissão negada/indisponível — envia sem GPS
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      );
    });
  }

  function enviar() {
    startTransition(async () => {
      const geo = await capturarGeo();
      const okObs = await comitarRascunhos(blocos.flatMap((b) => b.perguntas));
      if (!okObs) {
        setErro(ERRO_SALVAR);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return; // não envia com observação pendente de gravação
      }
      const todas = blocos.flatMap((b) => rascunhoDo(b));
      try {
        const r = await enviarAvaliacao(token, todas, geo);
        if (r?.erro) {
          setErro(r.erro);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (e) {
        // o redirect de sucesso do Next viaja como exceção — deixa passar
        if (
          e &&
          typeof e === "object" &&
          "digest" in e &&
          String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setErro(
          "Falha de conexão ao enviar. Suas respostas estão salvas — tente enviar novamente.",
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-28 pt-4">
      {/* Cabeçalho + progresso geral */}
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Avaliação Cliente Oculto
        </p>
        <h1 className="text-lg font-bold text-slate-900">{posto}</h1>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${(etapasOk / blocos.length) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {tela.tipo === "hub" && `${etapasOk} de ${blocos.length} etapas preenchidas`}
          {tela.tipo === "bloco" && `Etapa: ${bloco?.nome}`}
          {tela.tipo === "revisao" && "Revisão final"}
        </p>
      </header>

      {jaEnviada && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Avaliação enviada. Você pode revisar qualquer etapa e{" "}
          <strong>reenviar</strong>
          {revisavelAte ? ` até ${revisavelAte}` : " enquanto o link estiver válido"}
          . Depois disso o acesso é encerrado.
        </p>
      )}

      {erro && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {/* ===================== HUB DE ETAPAS ===================== */}
      {tela.tipo === "hub" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Siga o roteiro na ordem que preferir — toque numa etapa para
            avaliá-la.
            {etapasPendentes.length > 0 ? (
              <span className="mt-1 block font-semibold text-amber-700">
                {etapasPendentes.length === 1
                  ? "Existe 1 etapa para preencher."
                  : `Existem ${etapasPendentes.length} etapas para preencher.`}
              </span>
            ) : (
              <span className="mt-1 block font-semibold text-emerald-700">
                Todas as etapas preenchidas — revise e envie.
              </span>
            )}
          </p>
          {blocos.map((b, i) => {
            const st = statusDo(b);
            const pend = pendentesDo(b).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setErro(null);
                  setTela({ tipo: "bloco", indice: i });
                  window.scrollTo({ top: 0 });
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {i + 1}. {b.nome}
                  </p>
                  <p className="text-sm text-slate-500">
                    {st === "na"
                      ? "Marcada como não se aplica"
                      : `${b.perguntas.length} item${b.perguntas.length > 1 ? "s" : ""} de avaliação`}
                  </p>
                </div>
                {st === "completa" && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    ✓ Completa
                  </span>
                )}
                {st === "na" && (
                  <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Não se aplica
                  </span>
                )}
                {st === "pendente" && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {pend} pendente{pend > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ===================== ETAPA (BLOCO) ===================== */}
      {bloco && (
        <div className="space-y-4">
          {/* Etapa não se aplica ao posto */}
          <div
            className={`rounded-2xl border p-4 ${
              naDe(bloco.id).naoSeAplica
                ? "border-slate-300 bg-slate-100"
                : "border-slate-200 bg-white"
            }`}
          >
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={naDe(bloco.id).naoSeAplica}
                onChange={(e) => alternarNA(bloco, e.target.checked)}
                className="h-5 w-5"
              />
              Esta etapa não se aplica a este posto
            </label>
            {naDe(bloco.id).naoSeAplica && (
              <div className="mt-3">
                <textarea
                  value={naDe(bloco.id).comentario}
                  onChange={(e) =>
                    setBlocosNA((m) => ({
                      ...m,
                      [bloco.id]: { naoSeAplica: true, comentario: e.target.value },
                    }))
                  }
                  onBlur={(e) => salvarComentarioNA(bloco, e.target.value)}
                  rows={2}
                  placeholder="Comente o motivo (ex.: o posto não presta este serviço) — opcional"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Os itens desta etapa não contarão no cálculo do score.
                </p>
              </div>
            )}
          </div>

          {/* Perguntas (ocultas quando a etapa não se aplica) */}
          {!naDe(bloco.id).naoSeAplica &&
            bloco.perguntas.map((p, idx) => {
              const r = respostaDe(p.id);
              const feed = feedDe(p.id);
              const rasc = rascunhoDe(p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-slate-900">
                    {idx + 1}. {p.texto}
                    {p.obrigatoria && (
                      <span className="text-red-500" title="Item requisito"> *</span>
                    )}
                  </p>

                  {!r.naoSeAplica && (
                    <div className="mt-3">
                      {p.tipo === "SIM_NAO" && (
                        <div className="flex gap-2">
                          <BotaoOpcao
                            ativo={r.valor === "SIM"}
                            tom="positivo"
                            onClick={() => atualizar(p.id, { valor: "SIM" })}
                          >
                            Sim
                          </BotaoOpcao>
                          <BotaoOpcao
                            ativo={r.valor === "NAO"}
                            tom="negativo"
                            onClick={() => atualizar(p.id, { valor: "NAO" })}
                          >
                            Não
                          </BotaoOpcao>
                        </div>
                      )}
                      {p.tipo === "ATENDE_NAO_ATENDE" && (
                        <div className="flex gap-2">
                          <BotaoOpcao
                            ativo={r.valor === "ATENDE"}
                            tom="positivo"
                            onClick={() => atualizar(p.id, { valor: "ATENDE" })}
                          >
                            Atende
                          </BotaoOpcao>
                          <BotaoOpcao
                            ativo={r.valor === "NAO_ATENDE"}
                            tom="negativo"
                            onClick={() =>
                              atualizar(p.id, { valor: "NAO_ATENDE" })
                            }
                          >
                            Não atende
                          </BotaoOpcao>
                        </div>
                      )}
                      {p.tipo === "NOTA_1_5" && (
                        <Estrelas
                          valor={r.valor ? Number(r.valor) : null}
                          onChange={(nota) =>
                            atualizar(p.id, { valor: String(nota) })
                          }
                        />
                      )}
                      {p.tipo === "NOTA_1_10" && (
                        <div className="grid grid-cols-5 gap-1.5">
                          {Array.from({ length: 10 }, (_, i) =>
                            String(i + 1),
                          ).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => atualizar(p.id, { valor: n })}
                              className={`min-h-11 rounded-lg border text-base font-semibold ${
                                r.valor === n
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                      {p.tipo === "TEXTO" && (
                        <textarea
                          value={r.valor ?? ""}
                          onChange={(e) =>
                            atualizar(p.id, { valor: e.target.value })
                          }
                          rows={3}
                          placeholder="Escreva sua observação…"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
                        />
                      )}
                      {p.tipo === "FOTO" && (
                        <Observacoes
                          token={token}
                          perguntaId={p.id}
                          feed={feed}
                          rascunho={rasc}
                          onRascunho={(nr) =>
                            setRascunhos((a) => ({ ...a, [p.id]: nr }))
                          }
                          onNovaObservacao={(obs) =>
                            setObservacoes((a) => ({
                              ...a,
                              [p.id]: [...(a[p.id] ?? []), obs],
                            }))
                          }
                          onAtualizarObservacao={(obs) =>
                            setObservacoes((a) => ({
                              ...a,
                              [p.id]: (a[p.id] ?? []).map((o) =>
                                o.id === obs.id ? obs : o,
                              ),
                            }))
                          }
                          onRemoverObservacao={(id) =>
                            setObservacoes((a) => ({
                              ...a,
                              [p.id]: (a[p.id] ?? []).filter((o) => o.id !== id),
                            }))
                          }
                        />
                      )}
                    </div>
                  )}

                  {p.permiteNaoSeAplica && (
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={r.naoSeAplica}
                        onChange={(e) =>
                          atualizar(p.id, {
                            naoSeAplica: e.target.checked,
                            ...(e.target.checked ? { valor: null } : {}),
                          })
                        }
                        className="h-5 w-5"
                      />
                      Não se aplica
                    </label>
                  )}

                  {p.tipo !== "FOTO" && p.tipo !== "TEXTO" && !r.naoSeAplica && (
                    <AreaObservacoes
                      temConteudo={
                        feed.length > 0 ||
                        Boolean(rasc.texto) ||
                        rasc.fotos.length > 0 ||
                        Boolean(r.comentario)
                      }
                    >
                      {/* comentário antigo (modelo anterior), somente leitura */}
                      {r.comentario && (
                        <p className="mb-2 rounded-lg bg-white px-3 py-2 text-sm italic text-slate-600">
                          “{r.comentario}”
                        </p>
                      )}
                      <Observacoes
                        token={token}
                        perguntaId={p.id}
                        feed={feed}
                        rascunho={rasc}
                        onRascunho={(nr) =>
                          setRascunhos((a) => ({ ...a, [p.id]: nr }))
                        }
                        onNovaObservacao={(obs) =>
                          setObservacoes((a) => ({
                            ...a,
                            [p.id]: [...(a[p.id] ?? []), obs],
                          }))
                        }
                        onAtualizarObservacao={(obs) =>
                          setObservacoes((a) => ({
                            ...a,
                            [p.id]: (a[p.id] ?? []).map((o) =>
                              o.id === obs.id ? obs : o,
                            ),
                          }))
                        }
                        onRemoverObservacao={(id) =>
                          setObservacoes((a) => ({
                            ...a,
                            [p.id]: (a[p.id] ?? []).filter((o) => o.id !== id),
                          }))
                        }
                      />
                    </AreaObservacoes>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ===================== REVISÃO FINAL ===================== */}
      {tela.tipo === "revisao" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Confira o resumo antes de enviar. Após o envio não será possível
            alterar as respostas.
          </p>
          {blocos.map((b, i) => {
            const st = statusDo(b);
            const pendentes = pendentesDo(b);
            const respondidas = b.perguntas.filter((p) => {
              const r = respostaDe(p.id);
              return (
                r.naoSeAplica ||
                (r.valor !== null && r.valor !== "") ||
                (p.tipo === "FOTO" && totalFotos(p.id) > 0)
              );
            }).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setErro(null);
                  setTela({ tipo: "bloco", indice: i });
                  window.scrollTo({ top: 0 });
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{b.nome}</p>
                  <p className="text-sm text-slate-500">
                    {st === "na"
                      ? "Não se aplica a este posto"
                      : `${respondidas} de ${b.perguntas.length} respondidas`}
                  </p>
                </div>
                {st === "na" ? (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Não se aplica
                  </span>
                ) : pendentes.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Completo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ===================== BARRA FIXA ===================== */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-3">
          {tela.tipo === "hub" && (
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setTela({ tipo: "revisao" });
                window.scrollTo({ top: 0 });
              }}
              disabled={salvando}
              className="min-h-12 flex-1 rounded-xl bg-blue-600 text-base font-bold text-white active:bg-blue-700 disabled:opacity-50"
            >
              Revisar e enviar
            </button>
          )}

          {tela.tipo === "bloco" && (
            <>
              <button
                type="button"
                onClick={voltarAoHub}
                disabled={salvando}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
              >
                ‹ Etapas
              </button>
              <button
                type="button"
                onClick={concluirEtapa}
                disabled={salvando}
                className="min-h-12 flex-1 rounded-xl bg-blue-600 text-base font-bold text-white active:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Concluir etapa"}
              </button>
            </>
          )}

          {tela.tipo === "revisao" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErro(null);
                  setTela({ tipo: "hub" });
                  window.scrollTo({ top: 0 });
                }}
                disabled={salvando}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
              >
                ‹ Etapas
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={salvando || etapasPendentes.length > 0}
                className="min-h-12 flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white active:bg-emerald-700 disabled:opacity-50"
              >
                {salvando
                  ? "Enviando…"
                  : jaEnviada
                    ? "Reenviar avaliação"
                    : "Enviar avaliação"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
