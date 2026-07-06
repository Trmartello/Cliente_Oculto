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

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email },
  });
  if (!usuario || !usuario.ativo) {
    return { erro: "E-mail ou senha inválidos" };
  }
  const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senhaHash);
  if (!senhaOk) {
    return { erro: "E-mail ou senha inválidos" };
  }

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
