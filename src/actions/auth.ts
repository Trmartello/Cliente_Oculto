"use server";

import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { criarSessao, encerrarSessao, exigirSessao } from "@/lib/auth";
import { enviarEmail, rodapeEmail } from "@/lib/email";
import { baseUrlPublica } from "@/lib/token-avaliacao";
import { registrarAuditoria } from "@/lib/auditoria";

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

// ============ CICLO DE VIDA DE SENHA ============

export interface SenhaState {
  erro?: string;
  ok?: boolean;
}

const hashReset = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Troca a própria senha (usuário logado), conferindo a senha atual. */
export async function trocarMinhaSenha(
  _prev: SenhaState,
  formData: FormData,
): Promise<SenhaState> {
  const sessao = await exigirSessao();
  const atual = (formData.get("atual") as string) ?? "";
  const nova = (formData.get("nova") as string) ?? "";
  const confirma = (formData.get("confirma") as string) ?? "";
  if (nova.length < 6) {
    return { erro: "A nova senha deve ter pelo menos 6 caracteres" };
  }
  if (nova !== confirma) {
    return { erro: "A confirmação não corresponde à nova senha" };
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
  });
  if (!usuario || !(await bcrypt.compare(atual, usuario.senhaHash))) {
    return { erro: "Senha atual incorreta" };
  }
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await bcrypt.hash(nova, 10) },
  });
  await registrarAuditoria(
    sessao,
    "usuario.trocar_senha",
    "Usuario",
    usuario.id,
    "Alterou a própria senha",
  );
  return { ok: true };
}

/**
 * "Esqueci minha senha": gera token de reset e envia por e-mail. SEMPRE
 * retorna sucesso genérico (não revela se o e-mail existe) — sem enumeração.
 */
export async function solicitarResetSenha(
  _prev: SenhaState,
  formData: FormData,
): Promise<SenhaState> {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const usuario = email
    ? await prisma.usuario.findUnique({ where: { email } })
    : null;

  if (usuario && usuario.ativo) {
    const token = randomBytes(32).toString("hex");
    await prisma.resetSenha.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashReset(token),
        expiraEm: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });
    const base = await baseUrlPublica();
    const link = `${base}/redefinir-senha/${token}`;
    await enviarEmail(
      [usuario.email],
      "Redefinição de senha — Cliente Oculto",
      `<p>Recebemos um pedido para redefinir sua senha.</p>
       <p><a href="${link}" style="color:#2563eb">Clique aqui para criar uma nova senha</a> (o link vale por 1 hora).</p>
       <p>Se não foi você, ignore este e-mail.</p>
       ${rodapeEmail(base)}`,
    );
  }
  // resposta idêntica exista ou não o e-mail
  return { ok: true };
}

/** Redefine a senha a partir do token do e-mail (uso único, com validade). */
export async function redefinirSenhaComToken(
  _prev: SenhaState,
  formData: FormData,
): Promise<SenhaState> {
  const token = (formData.get("token") as string) ?? "";
  const nova = (formData.get("nova") as string) ?? "";
  const confirma = (formData.get("confirma") as string) ?? "";
  if (nova.length < 6) {
    return { erro: "A nova senha deve ter pelo menos 6 caracteres" };
  }
  if (nova !== confirma) {
    return { erro: "A confirmação não corresponde à nova senha" };
  }
  const reset = await prisma.resetSenha.findUnique({
    where: { tokenHash: hashReset(token) },
    include: { usuario: { select: { id: true, ativo: true } } },
  });
  if (
    !reset ||
    reset.usadoEm ||
    reset.expiraEm < new Date() ||
    !reset.usuario.ativo
  ) {
    return { erro: "Link inválido ou expirado. Solicite um novo." };
  }
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: reset.usuarioId },
      data: { senhaHash: await bcrypt.hash(nova, 10) },
    }),
    prisma.resetSenha.update({
      where: { id: reset.id },
      data: { usadoEm: new Date() },
    }),
    // invalida outros tokens pendentes do mesmo usuário
    prisma.resetSenha.updateMany({
      where: { usuarioId: reset.usuarioId, usadoEm: null },
      data: { usadoEm: new Date() },
    }),
  ]);
  return { ok: true };
}
