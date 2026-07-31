# Find4You Business Platform — código-fonte

Aplicação Next.js do sistema interno de gestão da Find4You (CRM + ATS +
Financeiro + Dashboards). Spec completa e decisões de arquitetura vivem em
[`docs/business-platform/`](../docs/business-platform/README.md) — este
README só cobre como rodar o projeto localmente. Convenções de código e
checklist de "módulo pronto" estão na skill
[`business-platform`](../.claude/skills/business-platform/SKILL.md).

Status: **Fase 0 (fundação)** — autenticação, papéis e shell da aplicação.
Os módulos de negócio (CRM, ATS, Financeiro...) chegam nas fases seguintes,
ver [`plano-modulos.md`](../docs/business-platform/plano-modulos.md).

## Stack

Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Supabase
(Auth/Postgres) + Prisma 7 + TanStack Query + React Hook Form + Zod — ver
[`arquitetura.md`](../docs/business-platform/arquitetura.md) para o porquê de
cada escolha.

## Setup — Opção A: Supabase local (Docker, recomendado para começar)

Roda a stack inteira (Postgres + Auth + Storage + Realtime + Studio) na sua
máquina via Docker, sem conta na nuvem e sem custo. É o mesmo código —
só troca a URL de destino. Requer **Docker Desktop** instalado e rodando, e o
[Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install
supabase/tap/supabase`).

### 1. Instalar dependências e subir a stack local

```bash
npm install
supabase init      # só na primeira vez — cria supabase/config.toml
supabase start      # sobe os containers; primeira vez baixa ~2GB de imagens
```

`supabase start` imprime `API_URL`, `ANON_KEY`, `DB_URL` e `STUDIO_URL` no
final — Studio local fica em `http://127.0.0.1:54323`.

### 2. Configurar `.env.local`

```bash
cp .env.example .env.local
```

Preencha com os valores impressos por `supabase start`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY do supabase start>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 3. Migrar e aplicar RLS

```bash
npm run db:migrate   # cria a tabela `usuarios`
```

Depois aplique `prisma/rls.sql` no Postgres local (não há SQL Editor local
por padrão — use `docker exec`):

```bash
docker exec -i supabase_db_$(basename "$PWD") psql -U postgres -d postgres < prisma/rls.sql
```

(troque `$(basename "$PWD")` pelo nome do container se ele não bater — `docker
ps | grep supabase_db` mostra o nome exato).

### 4. Criar seu usuário e virar admin

Sem projeto cloud não há painel "Add user" — crie via API do GoTrue local
(troque e-mail/senha):

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "apikey: <SERVICE_ROLE_KEY do supabase start>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY do supabase start>" \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@find4you.local","password":"escolha-uma-senha","email_confirm":true,"user_metadata":{"name":"Seu Nome"}}'
```

A trigger do passo 3 já criou a linha em `usuarios` com `papel = null`.
Torne-se admin:

```bash
docker exec -i supabase_db_$(basename "$PWD") psql -U postgres -d postgres -c \
  "update public.usuarios set papel = 'admin' where id = (select id from auth.users where email = 'voce@find4you.local');"
```

### 5. Rodar

```bash
npm run dev
```

Abra `http://localhost:3000` — redireciona para `/login`; depois do login,
para `/dashboard` com o menu filtrado pelo seu papel.

### Parar/retomar

```bash
supabase stop    # para os containers (mantém os dados)
supabase start   # retoma de onde parou
```

## Setup — Opção B: Supabase cloud (para produção)

Quando for hospedar de verdade, troque para um projeto real:

1. Crie uma conta em [supabase.com](https://supabase.com) (isso não pode ser
   feito por mim) e um novo projeto. Anote **Project URL**, **anon public
   key** (Project Settings → API) e a **connection string** do Postgres
   (Project Settings → Database) — use a conexão **direta** (porta 5432, não
   o pooler 6543) como `DATABASE_URL`, evita limitações do pgbouncer em modo
   transação durante `prisma migrate`.
2. Repita os passos 2-5 da Opção A trocando os valores locais pelos do
   projeto cloud, e o passo de RLS/usuário pelo **SQL Editor** do painel
   Supabase em vez de `docker exec`.

Nunca commite `.env.local` (já está no `.gitignore`) nem a `service_role
key` em lugar nenhum do código.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run db:generate` | Gera o Prisma Client (`lib/generated/prisma`) — não precisa de banco conectado |
| `npm run db:migrate` | Roda migrations do Prisma (precisa de `DATABASE_URL` válido) |
| `npm run db:studio` | Abre o Prisma Studio |

## Notas de implementação (Fase 0)

- **Papéis (`Papel`)** vêm de `prisma/schema.prisma` e controlam o que
  aparece no menu lateral (`lib/nav.ts`) — ver
  [`arquitetura.md`](../docs/business-platform/arquitetura.md), seção
  "Multi-tenancy e controle de acesso". Um usuário sem papel atribuído
  (`papel = null`) só vê o Dashboard.
- Todas as rotas de módulo de negócio (`/crm`, `/vagas`, `/financeiro` etc.)
  já existem no menu e são navegáveis, mas mostram um placeholder
  ("Coming Soon") até a fase correspondente do roadmap ser implementada —
  isso é intencional, não um bug.
- **Design System:** cores, tipografia (Plus Jakarta Sans/Inter/JetBrains
  Mono, carregadas via `next/font/google` — self-hosted, sem CDN em
  runtime) e radius vêm de `design-system/` (raiz do workspace), aplicados
  em `app/globals.css`. Nenhum token novo nasce aqui — ver
  [`design-system.md`](../docs/business-platform/design-system.md).
- `.claude/skills/`, `.windsurf/skills/`, `.agents/skills/` dentro desta
  pasta foram instalados automaticamente pelo `prisma init` (documentação de
  referência do Prisma 7 para assistentes de IA) — não é conteúdo deste
  projeto, mantenha ao atualizar o Prisma.

## Pendências conhecidas

- `npm audit` acusa vulnerabilidades em dependências de build (`eslint`,
  `postcss`, `sharp`, transitivas do próprio `create-next-app`) — nenhuma é
  de runtime exposto a usuário final; revisar antes de ir para produção.
- Hospedagem/CI/CD ainda não decididos — ver `arquitetura.md`, seção
  "Ambientes e deploy" (`[TODO] Definir com Thiago`).
