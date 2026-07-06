"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarUsuario, type ActionState } from "@/actions/cadastros";
import { Card, btnPrimario, btnSecundario, inputCls } from "@/components/ui";

interface UsuarioDados {
  id: string;
  nome: string;
  email: string;
  papel: string;
  postoId: string;
  regiao: string;
}

export function UsuarioForm({
  usuario,
  postos,
  regioes,
}: {
  usuario: UsuarioDados | null;
  postos: { id: string; nome: string }[];
  regioes: string[];
}) {
  const router = useRouter();
  const [papel, setPapel] = useState(usuario?.papel ?? "CONSULTA");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await salvarUsuario(prev, fd);
      if (r.ok) router.push("/cadastros/usuarios");
      return r;
    },
    {},
  );

  return (
    <details open={!!usuario} className="group">
      <summary className={`${btnSecundario} cursor-pointer list-none`}>
        {usuario ? `Editando: ${usuario.nome}` : "+ Novo usuário"}
      </summary>
      <Card className="mt-3">
        <form action={action} className="grid gap-4 md:grid-cols-3">
          {usuario && <input type="hidden" name="id" value={usuario.id} />}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome *</span>
            <input
              name="nome"
              required
              defaultValue={usuario?.nome}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail *</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={usuario?.email}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Senha {usuario ? "(deixe em branco para manter)" : "*"}
            </span>
            <input
              name="senha"
              type="password"
              autoComplete="new-password"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Perfil *</span>
            <select
              name="papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
              className={`mt-1 ${inputCls}`}
            >
              <option value="ADMIN">Administrador</option>
              <option value="CONTROLADORIA">Controladoria</option>
              <option value="GESTOR_REGIONAL">Gestor Regional</option>
              <option value="GERENTE">Gerente</option>
              <option value="CONSULTA">Consulta</option>
            </select>
          </label>
          {papel === "GERENTE" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Posto *</span>
              <select
                name="postoId"
                defaultValue={usuario?.postoId}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">Selecione…</option>
                {postos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {papel === "GESTOR_REGIONAL" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Região *</span>
              <select
                name="regiao"
                defaultValue={usuario?.regiao}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">Selecione…</option>
                {regioes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
          {state.erro && (
            <p className="text-sm text-red-600 md:col-span-3">{state.erro}</p>
          )}
          <div className="flex gap-2 md:col-span-3">
            <button type="submit" disabled={pending} className={btnPrimario}>
              {pending ? "Salvando…" : "Salvar usuário"}
            </button>
          </div>
        </form>
      </Card>
    </details>
  );
}
