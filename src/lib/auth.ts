import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Papel } from "@prisma/client";

const COOKIE_SESSAO = "sessao";
const DURACAO_SESSAO_S = 60 * 60 * 12; // 12h

export interface Sessao {
  usuarioId: string;
  nome: string;
  papel: Papel;
  postoId: string | null;
  regiao: string | null;
}

function segredo(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export async function criarSessao(sessao: Sessao): Promise<void> {
  const token = await new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sessao.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .sign(segredo());

  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DURACAO_SESSAO_S,
    path: "/",
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}

export async function obterSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return {
      usuarioId: payload.sub as string,
      nome: payload.nome as string,
      papel: payload.papel as Papel,
      postoId: (payload.postoId as string | null) ?? null,
      regiao: (payload.regiao as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Exige sessão válida; redireciona para /login se ausente. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  return sessao;
}

/** Exige sessão com um dos papéis informados; redireciona se não atender. */
export async function exigirPapel(...papeis: Papel[]): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!papeis.includes(sessao.papel)) redirect("/dashboard");
  return sessao;
}
