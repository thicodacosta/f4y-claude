---
name: instagram
description: >
  Use quando o usuário quiser criar conteúdo para Instagram (carrosséis, legendas,
  stories) e/ou configurar ou operar a publicação automática via Meta API. Cobre
  tanto a criação editorial quanto a camada técnica de automação. Acionar quando o
  usuário disser "criar um carrossel", "postar no Instagram", "quero publicar no
  Instagram", "configurar instagram", "setup instagram".
---

# Instagram

## Objetivo

Cobrir o canal Instagram de ponta a ponta: da ideia ao post publicado — tanto a
criação editorial quanto a automação técnica de publicação via Meta API.

## Quando utilizar

- Criar carrossel, legenda ou conteúdo de Instagram.
- Configurar (setup) ou operar a publicação automática via Meta API.

## Quando NÃO utilizar

- Decidir pauta/tema cross-channel antes de saber que o canal é Instagram →
  skill `marketing-conteudo`.
- Criar componente visual novo sem checar o Design System primeiro → skill
  `design-system`.

## Entradas

- Pauta/tema já definido (por `marketing-conteudo` ou pelo usuário).
- Vertical de negócio em foco.
- Para automação: credenciais Meta configuradas (ver seção B).

## Saídas

- Carrossel + legenda prontos para publicar.
- Post publicado (quando a automação é usada).

## A) Criação de conteúdo

1. Consulte `docs/marca/` para tom de voz e `prompts/instagram/carrossel.md`
   para o template de carrossel/legenda já existente — não redefina tom ou
   estrutura aqui, use o que já está documentado.
2. Formato padrão: carrossel de 2 a 10 slides + legenda. Slides devem seguir
   os componentes visuais definidos no Design System (skill `design-system`)
   — nunca criar layout novo de slide sem checar se já existe um padrão.
3. Checklist antes de considerar o conteúdo pronto para exportar:
   - Tom consultivo/sofisticado mantido (nada de linguagem "de rede social"
     genérica)
   - Legenda com CTA claro e alinhado à vertical de negócio em pauta
   - Slides seguem grid/tipografia do Design System

## B) Automação de publicação (Meta API)

Publicar carrosséis programaticamente usa
`automations/instagram/publish_instagram.py`. Esta seção documenta o setup
único da integração e a operação do dia a dia.

### Pré-requisitos

Confirme com o usuário antes de iniciar o setup:

1. A conta do Instagram é **Profissional** (Business ou Creator)?
   - Se não souber: Configurações → Conta → Tipo de conta
   - Se for pessoal: instrua a converter em Creator (gratuito, não perde
     seguidores)
2. Existe uma **Página no Facebook** vinculada ao Instagram?
   - Se não: instrua a criar uma página básica no Facebook
3. O usuário tem acesso ao e-mail/senha do Facebook que gerencia essa página?

Se algum item faltar, resolva-o antes de seguir para o setup.

### Setup do token (uma vez)

1. Acesse `https://developers.facebook.com/tools/explorer` (painel de
   desenvolvedores Meta — gratuito).
2. Em **"Meta App"**, selecione um app existente ou crie um novo (tipo
   **Business**).
3. Em **"User or Page"**, selecione a **Página do Facebook** (não "Usuário").
4. Em **"Add a Permission"**, adicione:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
5. Clique em **"Generate Access Token"** e autorize. O token começa com
   `EAA...`.
6. Valide o token (deve começar com `EAA` e ter mais de 100 caracteres):

```bash
node -e "
const TOKEN = 'TOKEN_DO_USUARIO_AQUI';
fetch('https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account&access_token=' + TOKEN)
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)));
"
```

Erros comuns nesta etapa:

| Erro | Causa | Solução |
|------|-------|---------|
| `OAuthException #200` | Permissões faltando | Voltar e adicionar as 3 permissões |
| `Invalid OAuth access token` | Token expirado | Gerar novo token no Graph API Explorer |
| `Instagram account not found` | Conta não é Business/Creator | Converter conta em Configurações → Conta |
| `Pages not found` | Página não vinculada ao Instagram | Vincular em Configurações do Instagram → Conta → Página vinculada |

O token do Graph API Explorer **expira em 1 hora**. Para uso contínuo, gere um
token de longa duração:

```bash
curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN_ATUAL}"
```

### Identificar o Instagram Business ID

Do resultado da chamada acima, identifique qual página tem
`instagram_business_account` preenchido e confirme com o usuário qual conta
usar. Guarde o `PAGE_TOKEN` e o `INSTAGRAM_BUSINESS_ID`.

### Salvar credenciais

Copie `automations/instagram/.env.example` para `automations/instagram/.env` e
preencha `INSTAGRAM_BUSINESS_ID`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCESS_TOKEN`.
Nunca versione o `.env` real.

### Publicar

```bash
pip install requests python-dotenv -q   # uma vez, se ainda não instalado
python automations/instagram/publish_instagram.py --images slides/*.png --caption "sua legenda"
```

Use `--dry-run` para validar antes de publicar de fato. Mínimo 2 imagens,
máximo 10.

### Teste de conexão

```bash
node -e "
const TOKEN = 'TOKEN_SALVO';
const IG_ID = 'IG_ID_SALVO';
fetch('https://graph.facebook.com/v19.0/' + IG_ID + '?fields=id,name,username&access_token=' + TOKEN)
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)));
"
```

Se retornar `username`, a conexão está funcionando.

## Checklist final antes de publicar

- [ ] Conteúdo passou pelo checklist da seção A
- [ ] `.env` configurado e testado (seção B)
- [ ] Legenda revisada quanto a tom e CTA
- [ ] Número de slides entre 2 e 10

## Dependências de docs/

- `docs/marca/tom-de-voz.md` — tom de voz e vocabulário a evitar

## Prompts relacionados

- `prompts/instagram/carrossel.md`
