/**
 * Verificação de prontidão para produção. Roda contra o ambiente atual
 * (usa DATABASE_URL/variáveis do processo). Não altera nada — só reporta.
 *
 *   node scripts/verificar-prontidao.mjs
 *   npx tsx scripts/verificar-prontidao.mjs   (se preferir)
 *
 * Em produção (Railway), rode no shell do serviço para conferir o ambiente
 * real. Saída com código != 0 se houver bloqueio crítico.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let bloqueios = 0;
let avisos = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bloqueio = (m) => {
  console.log(`  ✗ BLOQUEIO: ${m}`);
  bloqueios++;
};
const aviso = (m) => {
  console.log(`  ! aviso: ${m}`);
  avisos++;
};

console.log("\n== Variáveis de ambiente ==");
const env = process.env;
if (!env.AUTH_SECRET || env.AUTH_SECRET.includes("troque")) {
  bloqueio("AUTH_SECRET ausente ou ainda com o valor de exemplo (openssl rand -hex 32).");
} else if (env.AUTH_SECRET.length < 32) {
  aviso("AUTH_SECRET curto — use openssl rand -hex 32 (64 caracteres).");
} else ok("AUTH_SECRET definido.");

if (!env.DATABASE_URL) bloqueio("DATABASE_URL ausente.");
else ok("DATABASE_URL definido.");

if (env.STORAGE_DRIVER === "s3") {
  const faltando = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(
    (k) => !env[k],
  );
  if (faltando.length) bloqueio(`STORAGE_DRIVER=s3 mas faltam: ${faltando.join(", ")}.`);
  else ok("Storage S3 configurado (fotos permanentes).");
} else {
  aviso("STORAGE_DRIVER != s3 — fotos no filesystem efêmero somem a cada deploy. Use s3 em produção.");
}

if (env.APP_URL && env.APP_URL.includes("localhost")) {
  bloqueio("APP_URL aponta para localhost — remova a variável ou aponte para o domínio público.");
} else ok("APP_URL ok (ausente = herda do proxy, recomendado).");

if (!env.SMTP_HOST) aviso("SMTP não configurado — e-mails (NC, vencidos, reset de senha) viram apenas log.");
else ok("SMTP configurado.");

if (!env.CRON_SECRET) aviso("CRON_SECRET não definido — resumo diário de vencidos fica desabilitado.");
else ok("CRON_SECRET definido.");

console.log("\n== Banco de dados ==");
try {
  await prisma.$queryRaw`SELECT 1`;
  ok("Conexão com o banco OK.");
} catch (e) {
  bloqueio(`Sem conexão com o banco: ${e instanceof Error ? e.message : e}`);
}

try {
  const demo = await prisma.usuario.count({
    where: { email: { endsWith: "@clienteoculto.dev" }, ativo: true },
  });
  if (demo > 0)
    bloqueio(`${demo} usuário(s) demo (@clienteoculto.dev, senha123) ainda ATIVO(s) — desative antes do go-live.`);
  else ok("Nenhum usuário demo ativo.");

  const admins = await prisma.usuario.count({
    where: { papel: "ADMIN", ativo: true, email: { not: { endsWith: "@clienteoculto.dev" } } },
  });
  if (admins === 0) bloqueio("Nenhum administrador real ativo — crie o seu antes de desativar os demo.");
  else ok(`${admins} administrador(es) real(is) ativo(s).`);

  const meta = await prisma.meta.count({ where: { blocoNome: null } });
  if (meta === 0) aviso("Nenhuma meta geral cadastrada — o dashboard usa 85 como padrão e NC de meta não dispara.");
  else ok("Meta geral cadastrada.");

  const questAtivo = await prisma.questionario.count({ where: { status: "ATIVO" } });
  if (questAtivo === 0) bloqueio("Nenhum questionário ATIVO — não é possível gerar visitas.");
  else ok(`${questAtivo} questionário(s) ativo(s).`);

  const postos = await prisma.posto.count({ where: { ativo: true } });
  if (postos === 0) aviso("Nenhum posto ativo cadastrado.");
  else ok(`${postos} posto(s) ativo(s).`);
} catch (e) {
  bloqueio(`Falha ao consultar o banco: ${e instanceof Error ? e.message : e}`);
}

await prisma.$disconnect();

console.log("\n== Resumo ==");
console.log(`  Bloqueios: ${bloqueios} · Avisos: ${avisos}`);
if (bloqueios === 0) {
  console.log("  ✅ Pronto para produção (revise os avisos).");
  process.exit(0);
} else {
  console.log("  ❌ Resolva os bloqueios antes de liberar aos usuários.");
  process.exit(1);
}
