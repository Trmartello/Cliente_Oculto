"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { criarSessao, encerrarSessao } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export interface LoginState {
  erro?: string;
}

// ---- Proteção contra força bruta (melhor-esforço, memória do processo) ----
// 5 falhas seguidas para o mesmo e-mail → bloqueio de 15 minutos. Cobre o
// deploy padrão (uma instância no Railway); escala horizontal pede um
// limitador externo. O mapa é podado quando cresce demais.
const TENTATIVAS_MAX = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const falhasLogin = new Map<string, { falhas: number; bloqueadoAte: number }>();

function loginBloqueado(email: string): boolean {
  const reg = falhasLogin.get(email);
  return !!reg && reg.bloqueadoAte > Date.now();
}

function registrarFalhaLogin(email: string): void {
  if (falhasLogin.size > 1000) {
    const agora = Date.now();
    for (const [k, v] of falhasLogin) {
      if (v.bloqueadoAte < agora && v.falhas < TENTATIVAS_MAX) falhasLogin.delete(k);
    }
  }
  const reg = falhasLogin.get(email) ?? { falhas: 0, bloqueadoAte: 0 };
  reg.falhas += 1;
  if (reg.falhas >= TENTATIVAS_MAX) {
    reg.bloqueadoAte = Date.now() + BLOQUEIO_MS;
    reg.falhas = 0;
  }
  falhasLogin.set(email, reg);
}

// hash de sacrifício: e-mail inexistente/inativo paga o mesmo custo de
// bcrypt que um login real — sem isso o tempo de resposta entrega quais
// e-mails existem na base
const HASH_SACRIFICIO = bcrypt.hashSync("senha-sacrificio-timing", 10);

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0].message };
  }

  if (loginBloqueado(parsed.data.email)) {
    return {
      erro: "Muitas tentativas de acesso. Aguarde 15 minutos e tente de novo.",
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email },
  });
  if (!usuario || !usuario.ativo) {
    await bcrypt.compare(parsed.data.senha, HASH_SACRIFICIO);
    registrarFalhaLogin(parsed.data.email);
    return { erro: "E-mail ou senha inválidos" };
  }
  const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senhaHash);
  if (!senhaOk) {
    registrarFalhaLogin(parsed.data.email);
    return { erro: "E-mail ou senha inválidos" };
  }
  falhasLogin.delete(parsed.data.email);

  await criarSessao({
    usuarioId: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    postoId: usuario.postoId,
    regiao: usuario.regiao,
  });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
