# CLAUDE.md — Cliente Oculto (rede de postos)

Guia para agentes trabalharem neste repositório. Leia antes de editar.

## O que é

Sistema web de **Cliente Oculto** para redes de postos de combustíveis.
Avaliadores anônimos preenchem, **pelo celular**, um questionário com pesos e
criticidades parametrizáveis; o **motor de score** gera nota ponderada (0–100),
faixa **IGEO** e matriz Importância × Desempenho, tudo gravado como **snapshot
imutável**. A Controladoria analisa no **dashboard executivo** (desktop, estilo
BI com cross-filter). Falhas críticas e score abaixo da meta abrem **Não
Conformidade** automática com plano de ação.

- **Mobile** = coleta (`/avaliar/[token]`). **Desktop** = análise/gráficos.
- Idioma do produto e da comunicação com o usuário: **pt-BR**.

## Stack

Next.js **16.2.10** (App Router, Turbopack) · React **19.2.4** · TypeScript ·
Tailwind **v4** (via `@tailwindcss/postcss`, **sem** `tailwind.config`) · Prisma
**6.19** + **MySQL/MariaDB** · Recharts **3.9** · jose (JWT) · bcryptjs · zod
**v4** · `@aws-sdk/client-s3` · qrcode. Testes: **vitest v4**.

Domínio puro (motor de score) em `src/domain/` — sem framework, coberto por
testes.

## Comandos

```bash
npm run dev            # next dev (localhost:3000)
npm run build          # next build (roda typecheck — use para validar tipos)
npm test               # vitest run (26 testes do motor de score)
npm run db:migrate     # prisma migrate dev   (DEV: cria migração + aplica)
npm run db:deploy      # prisma migrate deploy (PROD/CI: só aplica)
npm run db:seed        # prisma db seed (usa tsx; dados demo)
npx tsx prisma/questionario-oficial.ts   # cria "Avaliação Oficial da Rede" (idempotente)
```

Não há script de `typecheck` isolado — use `npm run build`. Não há `lint`
específico do Next além de `eslint` (flat config em `eslint.config.mjs`).

## Arquitetura (mapa de arquivos)

```
prisma/schema.prisma          modelos + enums (MySQL)
prisma/seed.ts                usuários demo (senha123), postos, questionário demo, visitas
prisma/questionario-oficial.ts  roteiro oficial da rede (idempotente por nome)
src/domain/score/             motor puro: engine.ts, igeo.ts, tipos.ts + *.test.ts
src/lib/
  prisma.ts        singleton PrismaClient
  auditoria.ts     registrarAuditoria() — trilha "quem alterou o quê"; nunca derruba a operação
  email.ts         SMTP opcional (SMTP_*); sem config vira no-op logado
  auth.ts          sessão JWT (jose) em cookie; exigirSessao/exigirPapel; "server-only"
  rbac.ts          papéis + escopoVisita/escopoNC/escopoPosto (NÃO é server-only; ok no client)
  token-avaliacao.ts  gera/valida token; baseUrlPublica() monta o link público; "server-only"
  storage/         driver local (dev) ou s3 (prod); "server-only"
  dashboard.ts     carregarDashboard() — agrega snapshots com RBAC; "server-only"
  csv.ts / formato.ts  exportação CSV (Excel pt-BR) e rótulos/cores
src/actions/       server actions: auth, cadastros, questionarios, visitas, avaliacao, ncs
src/app/(publico)/ login, fluxo mobile /avaliar/[token] (wizard) e pesquisa /nps/[token]
src/app/(interno)/ dashboard (abas CO×Auditoria), visitas (+imprimir), nps,
                   nao-conformidades (kanban acompanha as ações),
                   planos-de-acao (3 níveis), cadastros/* (postos,
                   questionarios, avaliadores, ciclos, usuarios, metas,
                   auditoria), relatorios
src/app/api/       upload e leitura de evidências, exportações CSV
src/components/dashboard/charts.tsx  gráficos Recharts + cross-filter (client)
```

## Regras de negócio que NÃO se quebram

- **Snapshot imutável**: no envio, cada `Resposta` e a `Visita` congelam
  `notaObtida`, pesos, `criticidadeSnapshot`, `scoreItem`, `scoreFinal`,
  `scoresPorBloco` (JSON), `matrizJson` **e** `valorEnviado`/
  `naoSeAplicaEnviado`/`comentarioEnviado` (+`snapshotEnvioEm`). O autosave da
  janela de revisão altera só `valor/naoSeAplica/comentario` (rascunho); as
  telas de histórico (detalhe da visita, imprimir) exibem via
  `respostaExibida()` de `formato.ts` — nunca leia `valor` cru para exibir
  visita enviada. Mudar pesos depois **não** reescreve o histórico. Um
  questionário com visitas enviadas é **imutável** → nova versão.
- **Motor de score** (`src/domain/score/engine.ts`, testado): nota ponderada por
  pergunta dentro do bloco, blocos ponderados entre si; **falha crítica** quando
  razão da nota ≤ 0,4 numa pergunta CRITICA → penalidade `TETO`/`PERCENTUAL` e NC
  automática. Faixas IGEO por limites numéricos em `igeo.ts`. Não altere sem
  rodar `npm test`.
- **RBAC**: `escopoVisita/escopoNC/escopoPosto(sessao)` entram **na frente de toda
  query** de dados. ADMIN/CONTROLADORIA veem tudo; GESTOR_REGIONAL só a região;
  GERENTE só o posto; CONSULTA só leitura. Nunca remova o escopo de uma query.
- **Token do avaliador**: guardado como **hash sha256**. `validarToken` decide na
  ordem USADO (legado) → REVOGADO → EXPIRADO; expiração é **lazy** (persistida só
  no acesso, sem cron — é por design). **Janela de revisão**: o envio NÃO marca o
  token como usado — visita ENVIADA continua acessível para revisar/reenviar até
  `expiraEm`. O reenvio recalcula snapshots e **RECONCILIA** as NCs
  automáticas (não usa delete+create: a falha que persiste mantém a NC com
  responsável/status/ações; falha nova cria NC; falha que sumiu só é apagada
  se a NC estava intocada — as manuais nunca são tocadas). O envio abre com
  `SELECT ... FOR UPDATE` na visita para serializar duplo tap/retry. Ao
  expirar, visita ENVIADA permanece ENVIADA (só AGENDADA/EM_ANDAMENTO viram
  EXPIRADA).
- **Link público** (`baseUrlPublica()` em `token-avaliacao.ts`): resolve na ordem
  (1) `APP_URL` se **não** for localhost; (2) `x-forwarded-proto/host` (proxy do
  Railway) ou `Host`; (3) fallback dev. **Por isso o link funciona em produção
  sem `APP_URL`.** Nunca volte a montar link com valor fixo/localhost.
- **`TokenAcesso.tokenPlano`**: token cru guardado **apenas enquanto ATIVO**, para
  permitir reenvio (WhatsApp/copiar). É **zerado** ao revogar/cancelar/expirar
  (`revogarLink`, `cancelarVisita`, `validarToken`) — o envio da avaliação **não**
  zera mais (janela de revisão). Não exiba nem persista o token cru fora do
  estado ATIVO.

## Dashboard BI (cross-filter, seleção MÚLTIPLA)

- Estado vive na URL como **parâmetros repetidos**: `?posto=a&posto=b&bloco=X&bloco=Y&mes=2026-06`.
  OR dentro da dimensão, AND entre dimensões. Vira link compartilhável.
- Clique num elemento (barra do ranking, ponto do mês, ponto da matriz, linha da
  tabela de blocos, card de oportunidade) **soma** o valor à seleção; clicar de
  novo remove (`toggle` em `charts.tsx` via `useFiltrosBI`). Um **chip por valor**
  em `FiltrosAtivos`.
- `carregarDashboard` (`dashboard.ts`) recebe `postoIds[]`, `blocosNomes[]`,
  `meses[]`, `inicio/fim`. Gráficos-**origem** de um filtro não se filtram por si
  (o ranking mostra todos os postos, esmaecendo os não selecionados; idem meses).
  Com blocos selecionados, o score de cada visita vira a **média ponderada** (por
  peso do snapshot) dos blocos escolhidos. Cross-filter por bloco casa por
  **nome** no JSON do snapshot — renomear um Bloco quebra o match de visitas
  antigas.

## Wizard de avaliação (mobile)

- `src/app/(publico)/avaliar/[token]/wizard.tsx`. Navegação em **hub de
  etapas**: o avaliador escolhe a ordem (roteiro livre), o hub mostra "X de N
  etapas preenchidas" e badges por etapa (✓ Completa / N pendentes / Não se
  aplica). "Concluir etapa" valida e autosalva (`salvarRascunho`); "‹ Etapas"
  sai sem validar (também salva).
- **Etapa "não se aplica"** (`BlocoResposta`): checkbox no topo da etapa +
  comentário do motivo, persistido na hora via `marcarBlocoNaoSeAplica`. No
  envio, o engine recebe `opcoes.blocosNaoSeAplica` — o bloco não pontua, não
  gera falha crítica e os pesos dos demais são renormalizados (testado).
- Perguntas `NOTA_1_5` = **estrelas**. Cada item tem um **feed de
  observações** (`Observacao`): entradas com só texto, texto + N fotos ou só
  foto, exibidas na ordem de criação; composer com "Adicionar observação",
  remoção por entrada e auto-commit de rascunho esquecido ao concluir/enviar
  (`criarObservacao`/`removerObservacao`, posse conferida pelo token). Fotos
  são recomprimidas no aparelho e enviadas a `/api/upload`; perguntas tipo
  FOTO usam o mesmo feed (foto conta como resposta).

## Planos de Ação (3 níveis, estilo BSC)

- `PlanoAcao` (problema) → `IniciativaPlano` (item do checklist com
  inconsistência) → `AcaoPlano` (tarefa do gestor: responsável, prazo,
  progresso). Gerados automaticamente no envio: etapa com itens reprovados
  (razão ≤ 0,4) → plano canônico por **posto+bloco** (get-or-create, o mais
  antigo; reaberto se concluído); item reprovado → iniciativa com **dedupe
  por perguntaId** enquanto houver iniciativa não concluída.
- **Status semi-automático** (`src/lib/planos.ts`): NO_PRAZO/ATRASADA são
  derivados da data-limite — `sincronizarAcoesAtrasadas()` roda lazy no
  início das leituras e `resolverStatusAcao()` nas escritas; **só o par
  NO_PRAZO↔ATRASADA transita sozinho** — os manuais
  (EM_ANDAMENTO/CONCLUIDA/CANCELADA/PAUSADA/AGUARDANDO_VALIDACAO) nunca são
  sobrescritos, nem quando o prazo vence (o atraso aparece pela data em
  vermelho e no contador de "atrasadas", que usa `acaoVencida` por data, não
  só o status). No select da UI o automático aparece travado
  ("No prazo (automático)") e a edição oferece "Retomar automático".
  CONCLUIDA força progresso=100 e grava `concluidaEm`.
- Gestão por escopo (`podeGerirPlanoDoPosto`): GERENTE só o próprio posto,
  GESTOR_REGIONAL a região; CONSULTA não edita; excluir plano é
  ADMIN/CONTROLADORIA. Tudo auditado.
- **Kanban de NCs**: os cards acompanham a execução — todas as ações
  finalizadas (≥1 concluída) movem a NC para RESOLVIDA automaticamente
  (`reconciliarStatusNC`); reabrir ação devolve para EM_ANDAMENTO; botões
  ◀/▶ no card fazem o movimento manual.
- **`useFecharAoSalvar` depende da IDENTIDADE do estado** (objeto novo por
  submit), não do booleano `ok` — senão o modal não fecha na 2ª gravação da
  mesma instância. Não "simplifique" a dependência do efeito.

## Reenvio de link e reagendamento

- `CompartilharLink` (client) = botões **WhatsApp** (`wa.me/?text=`) + **Copiar**;
  `mensagemConvite()` fica em `convite.ts` (módulo comum, **não** client — pode
  ser chamado no servidor). Aparece na geração, na lista de visitas e no detalhe,
  para links **ATIVO** (reconstruídos de `tokenPlano`).
- `redefinirDataVisita` (action) reagenda a visita (nova `dataAgendada`) e pode
  estender a validade do link ativo — **sem** gerar novo token.

## Deploy (Railway)

- Serviço a partir do repo + addon MySQL; `DATABASE_URL` = reference variable do
  banco. `AUTH_SECRET` obrigatório (`openssl rand -hex 32`) — **runtime lança erro
  se ausente**. `APP_URL` opcional (ver link público acima). Fotos: use
  `STORAGE_DRIVER=s3` (filesystem do Railway é **efêmero**; `local` perde uploads
  a cada deploy).
- Pre-deploy: `npx prisma migrate deploy && npx tsx prisma/questionario-oficial.ts`
  (idempotente; pode ficar fixo). `next.config.ts` usa `output: "standalone"` e
  `serverExternalPackages: ["@prisma/client","bcryptjs"]` — não remova.
- **O Railway publica a branch configurada em Settings → Source.** Trabalho novo
  vive em `claude/new-project-dev-qhzsja`; se o serviço apontar para `main` sem o
  merge, o deploy roda código antigo / falha no pre-deploy.

## Convenções de trabalho neste repo

- **Branch**: desenvolva e faça push **só** em `claude/new-project-dev-qhzsja`.
  Não crie PR sem o usuário pedir.
- **Commits**: autor `Claude <noreply@anthropic.com>` (o Stop hook exige). Não
  inclua o identificador do modelo em nada versionado.
- **`"server-only"`**: `auth.ts`, `token-avaliacao.ts`, `dashboard.ts`, `csv.ts`,
  `storage/index.ts` importam `server-only` — importá-los num componente client
  quebra o build. `rbac.ts` e `formato.ts` podem ir ao client.
- **CSV** (`csv.ts`): separador `;`, `\r\n` e **BOM UTF-8** de propósito (Excel
  pt-BR). Não “limpe” o BOM.
- **Datas**: `formatarData` força `timeZone: "UTC"` (datas puras não retrocedem no
  fuso); `formatarDataHora` não força. Não uniformize.

## Ambiente de desenvolvimento (container)

- **MariaDB** cai entre sessões: reinicie com
  `(mysqld_safe --skip-syslog &)` e aguarde `mysqladmin -uoculto -poculto_dev ping`.
  Credenciais dev: `oculto` / `oculto_dev`, banco `cliente_oculto`.
- **Playwright**: `NODE_PATH=/opt/node22/lib/node_modules`, chromium em
  `/opt/pw-browsers/chromium` (não rode `playwright install`).
- **Prisma AI-guard** bloqueia `migrate reset`. Para recriar o banco **local**
  (nunca em produção): `mysql -uoculto -poculto_dev -e "DROP DATABASE ...; CREATE
  DATABASE cliente_oculto ..."` + `migrate deploy` + `db seed`.
- O proxy de egress bloqueia `railway.app`.
