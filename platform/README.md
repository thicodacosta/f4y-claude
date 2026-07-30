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

## Setup — do zero até rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto Supabase

Você precisa da sua própria conta em [supabase.com](https://supabase.com) —
isso não pode ser feito por mim. Crie um novo projeto e anote:

- **Project URL** e **anon public key** (Project Settings → API)
- **Connection string** do Postgres (Project Settings → Database →
  Connection string). Use a conexão **direta** (porta 5432, não o pooler
  6543) como `DATABASE_URL` — evita limitações do pgbouncer em modo
  transação durante `prisma migrate`.

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local` com os valores do passo 2. Nunca commite esse arquivo
(já está no `.gitignore`) nem a `service_role key` em lugar nenhum do
código.

### 4. Criar a tabela `usuarios` e aplicar RLS

```bash
npm run db:migrate   # cria a tabela `usuarios` a partir de prisma/schema.prisma
```

Depois, abra o **SQL Editor** do Supabase e rode o conteúdo de
[`prisma/rls.sql`](prisma/rls.sql) — habilita RLS, cria o helper de papel, a
trigger que sincroniza `auth.users` → `usuarios` no signup (sem papel, de
propósito) e a trigger que impede auto-promoção de papel. Prisma Migrate não
versiona RLS/triggers, por isso esse passo é manual.

### 5. Criar seu usuário e virar admin

1. Rode `npm run dev` e acesse `/login` — como ainda não existe usuário,
   crie um em **Authentication → Users → Add user** no painel do Supabase
   (e-mail + senha).
2. A trigger do passo 4 já criou sua linha em `usuarios` com `papel = null`.
   No SQL Editor, rode (trocando o e-mail):

   ```sql
   update public.usuarios set papel = 'admin'
   where id = (select id from auth.users where email = 'voce@find4you.com.br');
   ```

3. Faça login em `/login` com esse e-mail/senha.

### 6. Rodar

```bash
npm run dev
```

Abra `http://localhost:3000` — deve redirecionar para `/login`, e depois do
login, para `/dashboard` com o menu já filtrado pelo seu papel.

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
