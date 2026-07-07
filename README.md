# Cliente Oculto — Postos de Combustíveis

Sistema web de gestão de qualidade operacional para redes de postos de
combustíveis, baseado em avaliações de **Cliente Oculto** com metodologia de
**Score Ponderado** totalmente parametrizável.

## Como funciona

- A **Controladoria** cadastra postos, questionários (blocos, perguntas,
  pesos, criticidade) e metas — tudo pelo painel, sem alterar código.
- Para cada visita é gerado um **link com validade pré-definida**, que pode ser
  **compartilhado no WhatsApp** ou copiado — na geração, na lista de visitas e no
  detalhe (enquanto o link estiver ativo). O avaliador (cliente oculto) abre o
  link **no celular**, responde o questionário bloco a bloco por **estrelas
  (1–5)**, deixa comentários por item e **por foto**, anexa evidências e envia. A
  visita pode ser **reagendada** (redefinir data, estender validade) sem trocar o
  link. Depois do envio ou do vencimento, o link deixa de funcionar.
- No envio, o **motor de score** calcula a nota ponderada (0–100), a faixa
  **IGEO** (Excelência / Muito Bom / Bom / Regular / Crítico) e a matriz
  Importância × Desempenho. Os resultados são gravados como **snapshot
  imutável** — mudanças futuras de pesos não reescrevem o histórico.
- **Falha crítica** (ex.: não confirmou o combustível) aplica penalidade
  parametrizável (teto/percentual) e abre **Não Conformidade** automática com
  plano de ação; score abaixo da **meta** também gera NC.
- O **dashboard executivo** funciona como um **BI**: clicar em barras, pontos,
  linhas ou blocos aplica aquele valor como filtro para todo o painel, com
  **seleção múltipla** (vários postos, blocos e meses ao mesmo tempo) e estado
  compartilhável pela URL. Traz score geral, ranking de postos, evolução mensal,
  score por bloco, conformidade por criticidade, matriz de prioridades e as três
  maiores oportunidades por posto. Relatórios exportam em CSV (Excel pt-BR).

### Perfis de acesso

| Papel | Acesso |
| --- | --- |
| Administrador / Controladoria | tudo, incluindo cadastros e geração de links |
| Gestor Regional | dados apenas da sua região |
| Gerente | dados apenas do seu posto |
| Consulta | somente leitura |
| Avaliador | sem conta — acessa apenas pelo link temporário |

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + **MySQL** +
Recharts. O domínio (motor de score, IGEO, matriz) vive em `src/domain/` como
TypeScript puro, sem dependência de framework, coberto por testes (vitest).

## Rodando localmente

Pré-requisitos: Node 20+, MySQL 8 (ou MariaDB). Com Docker:

```bash
docker compose up -d   # sobe MySQL em localhost:3306
```

Sem Docker, crie o banco/usuário manualmente:

```sql
CREATE DATABASE cliente_oculto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'oculto'@'localhost' IDENTIFIED BY 'oculto_dev';
GRANT ALL PRIVILEGES ON *.* TO 'oculto'@'localhost';
```

Depois:

```bash
cp .env.example .env        # ajuste DATABASE_URL/AUTH_SECRET se necessário
npm install
npx prisma migrate dev      # cria as tabelas
npx prisma db seed          # dados demo + link de avaliação de exemplo
npm run dev                 # http://localhost:3000
```

O seed imprime os usuários demo (senha `senha123`) e um link `/avaliar/…`
para testar o fluxo do avaliador — abra-o em um celular ou no modo mobile do
DevTools.

Testes do motor de score:

```bash
npm test
```

## Deploy no Railway

1. Crie um serviço a partir deste repositório + um banco MySQL; aponte
   `DATABASE_URL` para a reference variable do banco.
2. Variáveis: `AUTH_SECRET` (openssl rand -hex 32), `APP_URL` (opcional — ver
   abaixo), `STORAGE_DRIVER=s3` + `S3_ENDPOINT`,
   `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   (Cloudflare R2, Backblaze B2 ou MinIO — o filesystem do Railway é efêmero,
   não use `local` em produção).
3. Pre-deploy command: `npx prisma migrate deploy && npx tsx prisma/questionario-oficial.ts`
   (o segundo comando cria o questionário oficial da rede e é idempotente —
   pode ficar fixo). Build/start padrão do Next.js (`npm run build` /
   `npm run start`).
4. O Railway publica a **branch** definida em *Settings → Source*. Aponte-a
   para a branch com o código mais recente antes de fazer deploy.

### Link do avaliador (celular) — como a URL é montada

O link `/avaliar/<token>` (e o QR code, que usa a mesma string) é montado por
`baseUrlPublica()` em `src/lib/token-avaliacao.ts`, nesta ordem:

1. `APP_URL`, se configurada com endereço público (valores com
   `localhost`/`127.0.0.1` são ignorados de propósito);
2. cabeçalhos da própria requisição (`x-forwarded-proto`/`x-forwarded-host`
   atrás de proxy — caso do Railway — ou `Host` direto);
3. fallback `http://localhost:3000` (apenas dev/scripts).

Ou seja: **em produção o link funciona mesmo sem `APP_URL`**, herdando o
domínio pelo qual a Controladoria acessou o sistema. Configure `APP_URL`
apenas para forçar um domínio específico (ex.: domínio próprio).

*Causa raiz do bug corrigido (jul/2026): `APP_URL` em produção ficou com o
valor de desenvolvimento (`http://localhost:3000`) e o link/QR gerados
apontavam para localhost — `ERR_CONNECTION_REFUSED` no celular do avaliador.
Além da derivação automática acima, a validação de tokens passou a registrar
logs (`[avaliacao] token …` com o motivo de recusa) e a geração de links
registra a base usada (`[link-avaliacao] …`).*

## Estrutura

```
prisma/               schema + seed
src/domain/score/     motor de score ponderado (puro, testado)
src/lib/              prisma, auth (JWT), rbac, tokens, storage, dashboard, csv
src/actions/          server actions (auth, cadastros, questionários, visitas, avaliação, NCs)
src/app/(publico)/    login e fluxo mobile /avaliar/[token]
src/app/(interno)/    dashboard, visitas, NCs, cadastros, relatórios
src/app/api/          upload/leitura de evidências e exportações CSV
```

## Roadmap (fases futuras)

- Pesquisa NPS, Auditoria Operacional e dashboard com IA (correlações e
  recomendações automáticas) sobre a mesma base.
- Evidências em vídeo/áudio, relatórios em PDF, criação manual de NCs.
