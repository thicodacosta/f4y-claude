# RH Lab X — Etapa 1: Planejamento

> Nome provisório: **RH Lab X**. Nome, logo, cores de destaque e textos
> institucionais ficam em configuração (tabela `configuracao_marca` + tokens
> CSS), editáveis no painel administrativo — nenhum texto de marca fixo no
> código.
>
> Base visual: Design System Find4You (`design-system/`), já implementado em
> código no `platform/app/globals.css` e reaproveitado no projeto
> `rhlabx/`.
>
> Status: planejamento. O projeto `rhlabx/` já tem estrutura inicial (Next.js
> + Supabase local + schema dos 6 módulos de Produtos); esse schema será
> ampliado na Etapa 3 com catálogo, ofertas e direitos de acesso.

---

## 1. As três frentes e como se diferenciam para o usuário

| Frente | Promessa para o usuário | Tipo de item | Quem é o titular do acesso |
|---|---|---|---|
| **Lab** | *Aprender* — cursos gravados e conteúdos de conhecimento | Curso | Pessoa (aluno) |
| **Toolkit** | *Usar agora* — ferramentas práticas do dia a dia de RH | Ferramenta | Pessoa (ou empresa, se a oferta for corporativa) |
| **Produtos** | *Implantar* — solução pronta de gestão de pessoas para a empresa | Produto modular | Empresa (organização) |

Regra de interface: todo card do catálogo mostra um selo com o **verbo**
(Aprender · Usar · Implantar) e o **estado de acesso** (Liberado · Incluso no
seu plano · Disponível para compra · Em breve · Protótipo).

---

## 2. Perfis de usuário

| Perfil | Como surge | O que pode fazer |
|---|---|---|
| **Visitante** | Sem login | Navegar pelo site, catálogo, páginas de itens, planos, FAQ; iniciar compra |
| **Aluno / profissional de RH** | Cadastro próprio ou compra confirmada | Painel pessoal, cursos e ferramentas que possui, perfil, consentimentos |
| **Administrador de empresa** | Quem contrata um Produto (ou é promovido por outro admin da empresa) | Gerir a organização: pessoas, equipes, convites, módulos contratados, papéis internos |
| **Colaborador convidado** | Convite de uma empresa | Usar apenas os módulos da empresa em que foi incluído, conforme papel interno (RH, gestor, colaborador) |
| **Administrador da plataforma** | Atribuído manualmente (nunca por cadastro) | Painel administrativo completo |

**Uma conta, vários vínculos.** Perfil não é um campo único do usuário:

- `usuario.papel_plataforma` → `usuario` | `admin_plataforma`
- `membro_organizacao` (N por usuário) → papel **dentro de cada empresa**:
  `admin_empresa` | `rh` | `gestor` | `colaborador`, com permissão separada
  `acesso_nr1`

Assim, a mesma pessoa pode ser aluna do Lab (direitos pessoais) e colaboradora
de uma empresa (direitos da organização), sem duas contas.

---

## 3. Mapa de navegação

### 3.1 Site público

```
/                          Início — proposta de valor, 3 frentes, ofertas em destaque, prova social
/lab                       O Lab — assuntos, trilha da jornada do colaborador, cursos em destaque
/toolkit                   Toolkit — ferramentas, estado de cada uma (funcional / protótipo / em breve)
/produtos                  Produtos — os 6 módulos, base comum, como contratar isolado ou em conjunto
/catalogo                  Catálogo pesquisável — filtros: frente, assunto, nível, etapa da jornada, acesso
/catalogo/[slug]           Página do item (curso, ferramenta ou produto) + ofertas que o incluem
/planos                    Planos, pacotes e formas de contratação (comparativo)
/faq                       Perguntas frequentes
/entrar  /cadastro         Login e cadastro (com aceite de termos e política de privacidade)
/compra/obrigado           Pós-checkout: "estamos confirmando seu pagamento" (nunca libera acesso sozinha)
/ativar/[token]            Comprador sem conta cria a conta e recebe os acessos já confirmados
/termos  /privacidade
```

Botão "Comprar" de cada oferta aponta para o destino configurado no admin
(checkout Kiwify no MVP; outro canal no futuro).

### 3.2 Área autenticada

```
/painel                    Painel inicial: Meu Lab · Meu Toolkit · Produtos da minha empresa · Explorar
/meu-lab                   Cursos que possui, progresso, prazos de acesso
/meu-lab/[slug]            Player: módulos, aulas em vídeo, materiais, marcar como concluída
/meu-toolkit               Ferramentas liberadas e disponíveis
/meu-toolkit/[slug]        Cada ferramenta em rota própria, com checagem de acesso no servidor
/empresa                   Início da empresa ativa: módulos contratados, base comum
/empresa/pessoas           Base comum: pessoas, equipes, convites e papéis (admin_empresa/rh)
/empresa/crm               Produto CRM de candidatos
/empresa/onboarding        Produto Onboarding
/empresa/feedback          Produto Feedback 1:1
/empresa/pulse             Produto Pulse
/empresa/pdi               Produto PDI
/empresa/nr1               Produto Diagnóstico NR-1 (acesso restrito)
/empresa/analytics         People Analytics (benefício complementar)
/conta                     Perfil, acessos, consentimentos, exportar/excluir dados (LGPD)
```

### 3.3 Painel administrativo (`/admin`, só `admin_plataforma`)

```
/admin                     Visão geral: vendas confirmadas, eventos com erro, uso
/admin/catalogo            Itens (cursos, ferramentas, produtos, benefícios) — publicar/ocultar
/admin/cursos/[id]         Editor de curso: módulos, aulas, vídeos, materiais
/admin/ofertas             Ofertas, planos e pacotes: preço exibido, itens liberados, links de checkout
/admin/clientes            Compradores, empresas, compras, assinaturas, direitos de acesso
/admin/acessos             Conceder/retirar acesso manualmente (com motivo obrigatório)
/admin/integracoes/kiwify  Status da integração, eventos recebidos, erros, reprocessar
/admin/uso                 Uso de cursos (progresso, conclusão) e produtos (orgs ativas)
/admin/marca               Nome, logo, textos institucionais, imagens, FAQ
/admin/auditoria           Registro de ações administrativas
```

---

## 4. Catálogo, ofertas, compras e direitos — os quatro conceitos

```
ItemCatalogo  ◄──N:N──  Oferta  ──1:N──►  CanalOferta (Kiwify: product_id + checkout_url)
     ▲                     ▲
     │                     │
DireitoAcesso ◄── gerado por ── Compra / Assinatura ◄── EventoIntegracao (webhook)
     │
titular = usuário OU organização
```

| Conceito | O que é | Exemplo |
|---|---|---|
| **Item do catálogo** | Algo que pode ser acessado: curso, ferramenta, produto ou benefício | "Crie seu próprio CRM de candidatos" (curso); "Calculadora de Turnover" (ferramenta); "Onboarding" (produto) |
| **Oferta** | Condição comercial que agrupa itens: avulsa, assinatura, pacote ou plano | "Plano Lab Anual" = todos os cursos por 12 meses; "Suíte completa" = 6 produtos + People Analytics + Turnover + Pesquisa Salarial |
| **Compra / assinatura** | Transação vinculada a um comprador e a um canal | Pedido Kiwify `order_id` X, aprovado em 24/09 |
| **Direito de acesso** | Permissão efetivamente concedida, com início, fim e origem | Usuário Ana → curso Y, de 24/09/2026 a 24/09/2027, origem: compra X |

Pontos de desenho:

- A oferta guarda **para quem** libera: `individual` (o comprador) ou
  `organizacao`. Ofertas para organização são concedidas manualmente pelo
  admin após contrato (decisão 3, seção 10) e não têm canal Kiwify.
- Os benefícios complementares dos Produtos (People Analytics, Calculadora
  de Turnover, Pesquisa Salarial) são **itens comuns do catálogo**, ligados às
  ofertas pelo admin — composição muda sem alterar código.
- Um item pode estar em várias ofertas; um usuário pode ter o mesmo item por
  várias origens. O acesso existe enquanto **qualquer** direito ativo
  existir — cancelar uma assinatura não retira o que foi comprado avulso.
- Item gratuito = flag `gratuito` no item (sem precisar de oferta de R$ 0).
- Maturidade do item: `funcional` | `prototipo` | `em_breve` — exibida
  sempre no catálogo e na página da ferramenta.

---

## 5. Estados da compra e regra de acesso em cada um

| Estado interno | Evento Kiwify que leva a ele | Acesso |
|---|---|---|
| `pendente` | `boleto_gerado`, `pix_gerado` | **Nenhum.** Só registra |
| `recusada` | `compra_recusada` | Nenhum |
| `aprovada` | `compra_aprovada` (confirmada na API) | **Concede** direitos da oferta pelo prazo da oferta (padrão avulsa: 12 meses) |
| `reembolsada` | `compra_reembolsada` | **Revoga** imediatamente os direitos originados por essa compra. Progresso em cursos é preservado (volta se recomprar) |
| `chargeback` | `chargeback` | Revoga imediatamente + sinaliza o cliente no admin |
| `assinatura_ativa` | `compra_aprovada` de produto recorrente, `subscription_renewed` | Concede/estende até o fim do período pago |
| `assinatura_atrasada` | `subscription_late` | Mantém o acesso durante os dias de tolerância (configurável; padrão 7), depois suspende |
| `assinatura_cancelada` | `subscription_canceled` | Mantém até o fim do período já pago, depois expira |
| `acesso_expirado` | Rotina diária (fim do prazo) | Sem acesso; histórico preservado |
| — | `carrinho_abandonado` | Só registrado (uso futuro em marketing), não cria compra |

Toda transição grava uma linha em `historico_compra` (estado anterior, novo
estado, evento de origem, data) e toda concessão/revogação grava em
`historico_direito` (quem: sistema/integração/admin X, motivo).

---

## 6. Integração Kiwify

### 6.1 O que a documentação oficial confirma hoje

Consultado em 24/09/2026 em `docs.kiwify.com.br`:

- **Eventos de webhook (lista oficial de `triggers`):** `boleto_gerado`,
  `pix_gerado`, `carrinho_abandonado`, `compra_recusada`, `compra_aprovada`,
  `compra_reembolsada`, `chargeback`, `subscription_canceled`,
  `subscription_late`, `subscription_renewed`.
- **Configuração do webhook:** criado no painel (Apps → Webhooks) ou via
  `POST https://public-api.kiwify.com/v1/webhooks` com `name`, `url`,
  `products` (id ou `all`), `triggers` e `token`.
- **API pública:** base `https://public-api.kiwify.com/v1/`; autenticação
  OAuth (`POST /oauth/token` com `client_secret`, token válido por 96 h) +
  cabeçalho `x-kiwify-account-id`; limite de 100 req/min.
- **Consulta de venda:** `GET /v1/sales/{id}` retorna, entre outros,
  `id`, `status` (exemplo documentado: `paid`), `product.id`,
  `customer.email`, `customer.name`, `approved_date`, `refunded_at`,
  `parent_order_id`, `tracking.*`. `GET /v1/sales` lista vendas em janelas de
  até 90 dias.

### 6.2 O que a documentação pública **não** confirma (validar antes da Etapa 4)

- **Estrutura exata do corpo do webhook de vendas** e **como o `token` é
  enviado/verificado** (a central de ajuda remete a uma página Notion que não
  está acessível publicamente). A página "Recebendo Webhooks" da API trata
  só de eventos bancários, com outro formato.
- **Lista completa de valores de `status`** da venda (só `paid` aparece como
  exemplo).
- **Endpoint de assinaturas:** não há na API pública; o estado da assinatura
  depende dos eventos `subscription_*`.
- **Passagem de parâmetro próprio no link de checkout** (os campos
  `tracking.src`/`sck` existem na venda, mas a documentação não descreve como
  preenchê-los pela URL).

**Procedimento:** na Etapa 4, criar um webhook de teste, disparar "Testar
webhook" na Kiwify e capturar os payloads reais de cada evento antes de
escrever o parser. Nenhum nome de campo do webhook será assumido.

### 6.3 Desenho que não depende da assinatura do webhook

O webhook é tratado como **notificação**, não como fonte de verdade:

```
Kiwify ──POST──► /api/webhooks/kiwify
                 1. grava o corpo bruto em evento_integracao (status: recebido) — sempre
                 2. valida o token configurado (mecanismo confirmado no passo 6.2)
                 3. responde 2xx
                 ─────────── processamento assíncrono ───────────
                 4. extrai o id do pedido → GET /v1/sales/{id} (confirmação na API)
                 5. product.id → CanalOferta → Oferta          (sem mapeamento = erro visível)
                 6. upsert Compra  (único por canal + order_id) ← idempotência
                 7. máquina de estados (seção 5) → upsert DireitoAcesso
                    (único por origem + item + titular)       ← sem acesso duplicado
                 8. vínculo com o usuário:
                    - customer.email já cadastrado → vincula
                    - senão → compra "aguardando conta" + e-mail com link /ativar/[token];
                      direitos são aplicados quando a conta é criada com aquele e-mail
                 9. status: processado | ignorado | erro (mensagem + tentativas)
```

- **Reprocessar:** eventos com erro aparecem em `/admin/integracoes/kiwify`
  com botão de reprocessar (volta ao passo 4).
- **Conciliação diária:** rotina consulta `GET /v1/sales` das últimas 48 h e
  compara com as compras registradas — pega webhooks perdidos.
- **Segredos:** `client_secret`, account id e token do webhook ficam em
  variáveis de ambiente do servidor (nunca no banco em texto puro, nunca
  `NEXT_PUBLIC_*`). O admin vê só "configurado / não configurado".
- **Página de obrigado** não libera nada: mostra "confirmando pagamento" e
  atualiza quando a compra muda para aprovada.

### 6.4 Implementação (Etapa 4, 25/09/2026)

Conferido novamente na documentação: o OAuth exige **`client_id` e
`client_secret`** (form-urlencoded) e devolve `expires_in`; `GET /v1/sales`
aceita `updated_at_start_date`/`updated_at_end_date` e documenta os 11
status da venda (`approved`, `authorized`, `chargedback`, `paid`, `pending`,
`pending_refund`, `processing`, `refunded`, `refund_requested`, `refused`,
`waiting_payment`). O **formato das datas de filtro não é especificado**
(implementado como `AAAA-MM-DD`, a confirmar no primeiro teste real).

Decisão de desenho: a fonte de verdade é **a listagem de vendas da API**, não
o corpo do webhook. O webhook só dispara a sincronização (vendas alteradas
desde a última, com margem de 24 h); a rotina diária repete a conciliação.
Consequências:

- Só `paid` e `approved` liberam; `refund_requested`/`pending_refund`
  mantêm até o reembolso efetivo; `refunded`, `chargedback` e `refused`
  retiram; os demais são pendentes.
- Assinatura: cada renovação é uma venda paga nova com período próprio
  (mensal 30 d, anual 365 d) + 7 dias de tolerância. Cancelamento ou atraso
  sem pagamento = acesso termina ao fim do período — exatamente a regra
  decidida, sem depender dos eventos `subscription_*`.
- Webhook sem o token configurado é gravado e ignorado; mesmo um evento
  forjado com token não concede nada (só provoca uma consulta à API).
- Comprador sem conta recebe convite por e-mail; ao criar a senha, aceita os
  termos e as compras são vinculadas. Compra só se liga a conta com e-mail
  confirmado.

### 6.5 Para ligar a Kiwify real

1. No painel da Kiwify, gerar as credenciais de API e colocar em variáveis
   de ambiente do servidor: `KIWIFY_ACCOUNT_ID`, `KIWIFY_CLIENT_ID`,
   `KIWIFY_CLIENT_SECRET`; remover `KIWIFY_API_URL` (simulador).
2. Gerar um token aleatório longo em `KIWIFY_WEBHOOK_TOKEN` e cadastrar o
   webhook `<site>/api/webhooks/kiwify` com esse token e todos os eventos.
3. Em cada oferta do admin, preencher o id do produto Kiwify e o link de
   checkout.
4. Clicar em "Testar webhook" na Kiwify e abrir o evento em
   `/admin/integracoes` para confirmar **onde o token chega** e o formato do
   corpo; então fixar a verificação do token nesse campo.
5. Fazer uma compra real de baixo valor e reembolsá-la: confirmar o formato
   de data dos filtros e o ciclo liberar → retirar.
6. Configurar `CRON_SECRET` (rotina diária `vercel.json`).

---

## 7. Regras de permissão (aplicadas no servidor)

Uma única função decide acesso a itens: `podeAcessar(usuario, item)`.

```
verdadeiro se:
  item.gratuito
  OU existe DireitoAcesso ativo (status = ativo E agora entre inicio e fim)
     com titular = usuario
  OU existe DireitoAcesso ativo com titular = organização O
     E usuario é membro ativo de O
     E o papel do usuario em O é permitido para aquele item
```

Chamada em toda página e Server Action de curso, ferramenta e produto — a
interface só reflete o resultado.

**Isolamento entre empresas:** toda tabela de dados de empresa tem
`organizacao_id`; toda consulta passa por um helper que injeta o escopo da
organização ativa do usuário (validada contra `membro_organizacao`). RLS
habilitada em todas as tabelas como segunda barreira (acesso direto pela API
do Supabase bloqueado).

**Dentro de uma empresa (Produtos):**

| Dado | admin_empresa / rh | gestor | colaborador |
|---|---|---|---|
| Pessoas, equipes | Todas | Sua equipe | Só a si |
| Onboarding | Todos | Da equipe | O próprio + tarefas atribuídas |
| Feedback 1:1 | Metadados (realizado/pendente) | Conversas que conduz, incluindo nota privada | As próprias, sem nota privada do gestor |
| PDI | Todos | Da equipe | O próprio |
| Pulse | Resultados agregados | Agregado da equipe se houver respostas suficientes | Responder |
| NR-1 | **Só com `acesso_nr1`** | **Só com `acesso_nr1`** | Responder |

**Confidencialidade de Pulse e NR-1:** a resposta é gravada sem vínculo com
a pessoa (participação e resposta em tabelas separadas, sem horário); nenhum
recorte é exibido com menos respostas que o mínimo configurado (padrão 5).

**NR-1:** resultados apresentados como **apoio à gestão e à análise por
profissionais responsáveis** — sem diagnóstico legal, clínico ou individual
automático. Esse texto aparece na tela de resultados e nos relatórios.

**Administração da plataforma:** toda concessão/retirada manual de acesso,
mudança de oferta, publicação de item e reprocessamento grava
`auditoria_admin` (quem, o quê, antes/depois, quando).

---

## 8. Modelo de dados (visão lógica)

**Identidade e consentimento**
- `usuario` (espelho de `auth.users`) — nome, e-mail, `papel_plataforma`
- `consentimento` — tipo (termos, privacidade, comunicação), versão, aceito em
- `organizacao`, `membro_organizacao` (papel, `acesso_nr1`, status),
  `convite`

**Catálogo e conteúdo**
- `item_catalogo` — tipo (curso | ferramenta | produto | benefício), slug,
  título, resumo, capa, status (rascunho | publicado | oculto), maturidade,
  gratuito, escopo (individual | organização)
- `taxonomia` + `item_taxonomia` — assunto, nível, etapa da jornada
- `curso` → `modulo_curso` → `aula` (provedor de vídeo + id, duração) →
  `material_aula`
- `progresso_aula` (usuário, aula, concluída, posição), `conclusao_curso`
- `certificado` — tabela criada, não usada no MVP
- `ferramenta` (chave do motor, limites de uso), `uso_ferramenta`
- `produto_modular` (chave do módulo: crm | onboarding | feedback | pulse |
  pdi | nr1 | analytics)

**Comercial**
- `oferta` — tipo (avulsa | assinatura | pacote | plano), preço exibido,
  periodicidade, duração do acesso, destinatário (individual | organização),
  status
- `oferta_item` — itens que a oferta libera
- `canal_oferta` — canal (kiwify | manual), id externo, link de checkout
- `compra` — comprador (usuário ou e-mail pendente), organização, oferta,
  canal, id externo (único por canal), estado, valores
- `assinatura` — compra de origem, estado, fim do período atual
- `historico_compra`
- `direito_acesso` — titular (usuário XOR organização), item, origem,
  início, fim, estado; único por (origem, item, titular)
- `historico_direito`

**Integração e administração**
- `evento_integracao` — canal, corpo bruto, chave de deduplicação, estado,
  tentativas, erro
- `auditoria_admin`
- `configuracao_marca`, `conteudo_institucional` (textos/imagens editáveis),
  `faq`

**Produtos (base comum da empresa)** — já modelado em
`rhlabx/prisma/schema.prisma`: pessoas, equipes, histórico, notificações e as
tabelas dos 6 módulos. Na Etapa 3 a "organização" desse schema passa a ser a
mesma `organizacao` do comercial, e "módulos contratados" deixa de ser uma
tabela própria: vira consulta aos `direito_acesso` da organização.

---

## 9. Proposta de MVP e ordem de construção

Princípio: **lançar vendendo o Lab**, que depende só de conteúdo gravado,
catálogo e controle de acesso, enquanto Toolkit e Produtos entram por ondas.
Nada é exibido como funcional antes de ser.

| Onda | Entrega | Pode vender? |
|---|---|---|
| **1. Fundação comercial** | Site público completo, catálogo filtrável, cadastro/login, consentimentos, ofertas e direitos, admin de catálogo/ofertas/acessos/marca, integração Kiwify com conciliação | Sim — primeiro lançamento |
| **1. Lab** (junto) | Cursos gravados: player, módulos, materiais, progresso, "continuar", conclusão. Conteúdos iniciais publicados conforme ficarem prontos (os demais aparecem como "em breve") | Sim |
| **1. Toolkit leve** (junto) | **Calculadora de Turnover** (cálculo sobre dados do próprio usuário), **Biblioteca de prompts** (conteúdo), **Construtor de CV** (formulário → PDF). Demais ferramentas: "em breve" | Sim |
| **2. Toolkit com IA** | **Comparativo de Candidatos** (evidências e lacunas por critério, sem recomendar contratação/reprovação), **Assistente PeopleLab IA** | Sim, com limite de uso por plano |
| **3. Produtos — base comum + 2 módulos** | Organização, pessoas, equipes, convites, papéis; **CRM de candidatos + Onboarding** (sequência natural da jornada: contratou → integra) | Sim, para empresas, por proposta com liberação manual |
| **4. Produtos — escuta e desenvolvimento** | **Feedback 1:1 + PDI** (integrados), **Pulse** | Sim |
| **5. NR-1 + People Analytics** | Diagnóstico NR-1 com plano de ação; People Analytics sobre os módulos em uso (só indicadores com dados suficientes) | Sim |
| **6. Dados externos** | **Pesquisa Salarial** — depende de fonte de dados (ver decisões) | — |
| Depois | Certificados, novos canais de venda, novas ferramentas | — |

Se a demanda regulatória tornar o **NR-1** o produto com maior urgência
comercial, ele pode subir para a onda 3 (depende só da base comum), sem
alterar as demais.

---

## 10. Decisões comerciais

### Decididas (2026-09-24)

| # | Decisão | Impacto no produto |
|---|---|---|
| 3 | **Produtos para empresas: contratação manual** (proposta + contrato), sem venda pela Kiwify | Kiwify atende só Lab, Toolkit e planos individuais. O admin cria a organização, define o admin da empresa e concede os direitos dos módulos em `/admin/acessos` (origem `manual`, com contrato de referência e prazo). Nenhum fluxo de checkout para Produtos; páginas de Produtos terminam em "Fale com a gente" |
| 4 | **Compra avulsa dá acesso por 12 meses** | Padrão `duracao_acesso_dias = 365` nas ofertas avulsas (pode ser sobrescrito por oferta) |
| 7 | **Minutas jurídicas preparadas** | `juridico/termos-de-uso.md`, `juridico/politica-de-privacidade.md`, `juridico/acordo-tratamento-dados.md` (DPA para o contrato de empresas). Viram as páginas `/termos` e `/privacidade`, editáveis no admin, com versão registrada no aceite |

### Com padrão provisório (configurável no admin, sem bloquear a construção)

- **Tolerância de assinatura atrasada:** 7 dias.
- **Após cancelamento:** acesso até o fim do período pago.

### Em aberto — não bloqueiam as Etapas 2 e 3

1. **Preços e composição das ofertas:** as ofertas de demonstração serão
   marcadas como tal; preços reais entram pelo admin.
2. **Cobrança dos Produtos (por módulo ou por colaborador):** como a
   liberação é manual, o direito de acesso da organização ganha um campo
   opcional `limite_pessoas_ativas`; só é aplicado se a cobrança for por
   colaborador.
5. **Provedor de vídeo:** a aula guarda `provedor` + `id_video`; o player é
   um componente com adaptador por provedor. Na demonstração, as aulas
   mostram um espaço "vídeo a publicar".

### Pendências do lado de vocês antes do lançamento

- **Revisão jurídica das minutas** e preenchimento de razão social, CNPJ,
  foro e prazos.
- **Nomeação formal do encarregado de dados (DPO):** pessoa física ou
  jurídica indicada pela empresa, com e-mail de contato publicado.
- **Pesquisa Salarial — fonte de dados (ver 10.1).**

### 10.1 Pesquisa Salarial: LinkedIn, Robert Half, Glassdoor

As três fontes indicadas não podem ser usadas como **base de dados da
ferramenta** sem acordo:

- **LinkedIn** e **Glassdoor** proíbem nos termos de uso a coleta
  automatizada (scraping) e a reutilização comercial dos dados. Acesso
  legítimo só por produto/licença deles (ex.: LinkedIn Talent Insights) ou
  parceria.
- **Robert Half** publica o Guia Salarial; as tabelas são conteúdo
  protegido. Reproduzi-las dentro de um produto pago exige autorização.

Caminhos possíveis:

1. **Referências externas (possível já):** a ferramenta mostra links para os
   guias e páginas públicas das três fontes, com data, sem copiar os
   números. É conteúdo de apoio, não motor de dados.
2. **Base própria colaborativa (recomendado para produto real):** usuários
   informam faixas salariais de forma anônima (cargo, senioridade, região,
   porte); a ferramenta só exibe um recorte com número mínimo de
   contribuições, a mesma regra de k-anonimato do Pulse.
3. **Licenciamento:** contratar dados de um provedor que permita uso
   comercial.

Até existir o caminho 2 ou 3, a Pesquisa Salarial fica **"Em breve"**,
com a opção 1 disponível como página de referências.

---

## 11. Stack

Mesma do `platform/` e do `matchwork/`, para reaproveitar padrões:
Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui · Supabase
(Auth, Postgres, Storage) · Prisma 7 · Vercel · vídeos em provedor externo ·
IA via Claude API (server-only) · rotinas agendadas (expiração, conciliação)
via cron do Vercel ou `pg_cron`.

Projeto independente em `rhlabx/`: não compartilha banco, deploy nem auth
com `platform/` nem `matchwork/`.
