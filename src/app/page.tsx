import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";

export default async function Home() {
  const sessao = await obterSessao();
  redirect(sessao ? "/dashboard" : "/login");
}
