"use client";

import { useRef, useState, useTransition } from "react";
import {
  enviarAvaliacao,
  salvarLegendaEvidencia,
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
  comentario: string | null;
};

/** Foto enviada + sua legenda (comentário da foto). */
type FotoLocal = { id: string; legenda: string | null };

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

function FotoUpload({
  token,
  perguntaId,
  fotos,
  onNovaFoto,
  onLegenda,
}: {
  token: string;
  perguntaId: string;
  fotos: FotoLocal[];
  onNovaFoto: (id: string) => void;
  onLegenda: (id: string, legenda: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
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
      onNovaFoto(json.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio da foto");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-2">
      {/* Cada foto com um campo de legenda/comentário logo abaixo */}
      {fotos.length > 0 && (
        <ul className="mb-2 space-y-2">
          {fotos.map((f) => (
            <li key={f.id} className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/evidencia/${f.id}?token=${encodeURIComponent(token)}`}
                alt="Foto enviada"
                className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
              <input
                type="text"
                defaultValue={f.legenda ?? ""}
                onBlur={(e) => onLegenda(f.id, e.target.value)}
                placeholder="Comentário desta foto (opcional)"
                className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
        aria-label="Adicionar foto"
      >
        {enviando ? "Enviando foto…" : "📷 Adicionar foto"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
        }}
      />
    </div>
  );
}

/** Campo de comentário do item (independe de foto — pode ir sozinho). */
function ComentarioItem({
  comentario,
  onComentario,
}: {
  comentario: string | null;
  onComentario: (texto: string) => void;
}) {
  return (
    <textarea
      value={comentario ?? ""}
      onChange={(e) => onComentario(e.target.value)}
      rows={2}
      placeholder="Comentário (opcional)"
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
    />
  );
}

// Área expansível: comentário do item + fotos (cada foto com sua legenda).
function ComentarioFoto({
  token,
  perguntaId,
  comentario,
  fotos,
  onComentario,
  onNovaFoto,
  onLegenda,
}: {
  token: string;
  perguntaId: string;
  comentario: string | null;
  fotos: FotoLocal[];
  onComentario: (texto: string) => void;
  onNovaFoto: (id: string) => void;
  onLegenda: (id: string, legenda: string) => void;
}) {
  const [aberto, setAberto] = useState(
    Boolean(comentario) || fotos.length > 0,
  );

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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Comentário e fotos deste item
      </p>
      <div className="mt-2">
        <ComentarioItem comentario={comentario} onComentario={onComentario} />
      </div>
      <FotoUpload
        token={token}
        perguntaId={perguntaId}
        fotos={fotos}
        onNovaFoto={onNovaFoto}
        onLegenda={onLegenda}
      />
    </div>
  );
}

export function AvaliacaoWizard({
  token,
  posto,
  blocos,
  respostasIniciais,
  evidenciasIniciais,
}: {
  token: string;
  posto: string;
  blocos: BlocoW[];
  respostasIniciais: Record<string, RespostaLocal>;
  evidenciasIniciais: Record<string, FotoLocal[]>;
}) {
  const [passo, setPasso] = useState(0); // blocos.length = revisão
  const [respostas, setRespostas] = useState<Record<string, RespostaLocal>>(
    respostasIniciais,
  );
  const [fotos, setFotos] = useState<Record<string, FotoLocal[]>>(
    evidenciasIniciais,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const totalPassos = blocos.length + 1;
  const naRevisao = passo === blocos.length;
  const bloco = naRevisao ? null : blocos[passo];

  function respostaDe(perguntaId: string): RespostaLocal {
    return (
      respostas[perguntaId] ?? { valor: null, naoSeAplica: false, comentario: null }
    );
  }

  function fotosDe(perguntaId: string): FotoLocal[] {
    return fotos[perguntaId] ?? [];
  }

  function atualizar(perguntaId: string, mudanca: Partial<RespostaLocal>) {
    setRespostas((atual) => ({
      ...atual,
      [perguntaId]: { ...respostaDe(perguntaId), ...mudanca },
    }));
    setErro(null);
  }

  function adicionarFoto(perguntaId: string, id: string) {
    setFotos((atual) => ({
      ...atual,
      [perguntaId]: [...(atual[perguntaId] ?? []), { id, legenda: null }],
    }));
  }

  function definirLegenda(perguntaId: string, id: string, legenda: string) {
    setFotos((atual) => ({
      ...atual,
      [perguntaId]: (atual[perguntaId] ?? []).map((f) =>
        f.id === id ? { ...f, legenda } : f,
      ),
    }));
    // persiste sem bloquear a UI
    void salvarLegendaEvidencia(token, id, legenda);
  }

  function pendentesDo(b: BlocoW): PerguntaW[] {
    return b.perguntas.filter((p) => {
      if (!p.obrigatoria || p.tipo === "TEXTO") return false;
      if (p.tipo === "FOTO") return fotosDe(p.id).length === 0;
      const r = respostaDe(p.id);
      return !r.naoSeAplica && (r.valor === null || r.valor === "");
    });
  }

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

  function avancar() {
    if (!bloco) return;
    const pendentes = pendentesDo(bloco);
    if (pendentes.length > 0) {
      setErro(`Responda: ${pendentes[0].texto}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      await salvarRascunho(token, rascunhoDo(bloco)); // autosave
      setPasso((p) => p + 1);
      window.scrollTo({ top: 0 });
    });
  }

  function voltar() {
    setErro(null);
    setPasso((p) => Math.max(0, p - 1));
    window.scrollTo({ top: 0 });
  }

  function enviar() {
    startTransition(async () => {
      const todas = blocos.flatMap((b) => rascunhoDo(b));
      const r = await enviarAvaliacao(token, todas);
      if (r?.erro) {
        setErro(r.erro);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-28 pt-4">
      {/* Cabeçalho + progresso */}
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Avaliação Cliente Oculto
        </p>
        <h1 className="text-lg font-bold text-slate-900">{posto}</h1>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${((passo + 1) / totalPassos) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {naRevisao
            ? "Revisão final"
            : `Etapa ${passo + 1} de ${blocos.length}: ${bloco?.nome}`}
        </p>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {/* Perguntas do bloco atual */}
      {bloco && (
        <div className="space-y-4">
          {bloco.perguntas.map((p, idx) => {
            const r = respostaDe(p.id);
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-slate-900">
                  {idx + 1}. {p.texto}
                  {p.obrigatoria && p.tipo !== "TEXTO" && (
                    <span className="text-red-500"> *</span>
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
                      <div>
                        <FotoUpload
                          token={token}
                          perguntaId={p.id}
                          fotos={fotosDe(p.id)}
                          onNovaFoto={(id) => adicionarFoto(p.id, id)}
                          onLegenda={(id, legenda) =>
                            definirLegenda(p.id, id, legenda)
                          }
                        />
                        {/* comentário avulso do item, mesmo em pergunta de foto */}
                        <div className="mt-3">
                          <ComentarioItem
                            comentario={r.comentario}
                            onComentario={(texto) =>
                              atualizar(p.id, { comentario: texto })
                            }
                          />
                        </div>
                      </div>
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
                  <ComentarioFoto
                    token={token}
                    perguntaId={p.id}
                    comentario={r.comentario}
                    fotos={fotosDe(p.id)}
                    onComentario={(texto) =>
                      atualizar(p.id, { comentario: texto })
                    }
                    onNovaFoto={(id) => adicionarFoto(p.id, id)}
                    onLegenda={(id, legenda) =>
                      definirLegenda(p.id, id, legenda)
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Revisão final */}
      {naRevisao && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Confira o resumo antes de enviar. Após o envio não será possível
            alterar as respostas.
          </p>
          {blocos.map((b, i) => {
            const pendentes = pendentesDo(b);
            const respondidas = b.perguntas.filter((p) => {
              const r = respostaDe(p.id);
              return (
                r.naoSeAplica ||
                (r.valor !== null && r.valor !== "") ||
                (p.tipo === "FOTO" && fotosDe(p.id).length > 0)
              );
            }).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setPasso(i)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{b.nome}</p>
                  <p className="text-sm text-slate-500">
                    {respondidas} de {b.perguntas.length} respondidas
                  </p>
                </div>
                {pendentes.length > 0 ? (
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

      {/* Barra de navegação fixa */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-3">
          {passo > 0 && (
            <button
              type="button"
              onClick={voltar}
              disabled={salvando}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
            >
              Voltar
            </button>
          )}
          {naRevisao ? (
            <button
              type="button"
              onClick={enviar}
              disabled={salvando || blocos.some((b) => pendentesDo(b).length > 0)}
              className="min-h-12 flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? "Enviando…" : "Enviar avaliação"}
            </button>
          ) : (
            <button
              type="button"
              onClick={avancar}
              disabled={salvando}
              className="min-h-12 flex-1 rounded-xl bg-blue-600 text-base font-bold text-white active:bg-blue-700 disabled:opacity-50"
            >
              {salvando
                ? "Salvando…"
                : passo === blocos.length - 1
                  ? "Ir para revisão"
                  : "Avançar"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
