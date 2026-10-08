# Sistema de Design Candy Studio

A Candy Studio é uma agência digital AI-first que projeta e constrói produtos digitais modernos — landing pages, sites institucionais, blogs, plataformas SaaS, CRMs, sistemas de estoque e financeiros, agentes de IA, workflows de automação e conteúdo de marketing — para pequenas empresas, startups, empresas de tecnologia, prestadores de serviço e clientes de saúde/finanças/varejo.

Filosofia: UI/UX premium, arquitetura limpa, desenvolvimento assistido por IA, entrega rápida. A identidade visual é inspirada em Stripe, Linear, Vercel, Framer, Notion, OpenAI, Supabase e Anthropic — SaaS moderno, minimalista, premium, focado em tecnologia.

**Fonte deste sistema:** um briefing de marca escrito, fornecido diretamente pelo usuário (paleta, tipografia, raios, inventário de componentes, stack de destino). Nenhum código-fonte, arquivo do Figma ou logo existente foi anexado — tudo aqui (tokens, componentes, UI kits) foi criado a partir desse briefing, e não recriado a partir de um produto existente. Se existir um codebase ou arquivo do Figma da Candy Studio, anexe-o para que este sistema possa ser conciliado com a fonte real.

Stack de destino referenciada no briefing (para orientação de implementação, não usada para construir este sistema em HTML/CSS): React, Next.js, TypeScript, Tailwind CSS, Shadcn/UI, Recharts, React Hook Form, Zod, Supabase, Lucide Icons.

## Fundamentos de conteúdo

- **Voz:** confiante, direta, focada em resultado. Frases curtas e declarativas. Fala sobre entregar e resultados, não sobre jargão de processo.
- **Pessoa:** fala como "nós" sobre a agência, "você"/"seu" sobre o produto do cliente — endereçamento direto, sem terceira pessoa ("os clientes recebem...").
- **Caixa:** sentence case em todo lugar — títulos, botões, labels de navegação. Nunca Title Case, nunca CAIXA ALTA, exceto em textos minúsculos de eyebrow/label (ex: "AGÊNCIA AI-FIRST" como um tag em 11px maiúsculo é a única exceção, seguindo a convenção de eyebrow da Linear/Vercel).
- **Pontuação:** mínima. Títulos não usam ponto final; textos de corpo usam pontuação normal. Travessões para apartes ("UI premium — sem o overhead de agência").
- **Emoji:** nunca. Nenhum ícone decorativo substituindo palavras — ícones ilustram, não substituem o texto.
- **Exemplo de título:** "Lance produtos que convertem." Exemplo de corpo: "Projetamos e construímos produtos digitais modernos — landing pages, dashboards e agentes de IA — com UI premium e arquitetura limpa."
- **Números/prova:** usados com moderação e apenas quando concretos (prazos de entrega, percentuais em depoimentos) — nunca estatísticas inventadas como preenchimento.

## Fundamentos visuais

- **Cor:** uma cor de ação primária (índigo #4F46E5) carrega todos os CTAs; violeta e ciano são apenas de suporte/destaque, usadas em gradientes e visualização de dados, nunca como uma segunda cor de CTA concorrente. Os neutros são a escala zinc do Tailwind (zinc-50 background/surface até zinc-950 dark mode). Cores semânticas (verde/âmbar/vermelho) são reservadas estritamente para status — sucesso, aviso, erro — nunca decoração.
- **Gradientes:** usados com moderação — fundos de hero (um mesh muito claro índigo/violeta, não uma diagonal chamativa), a variante "gradient" do botão, e o CTA do plano de preço em destaque. Nunca como fundo full-bleed chamativo.
- **Tipografia:** Geist para display/títulos (tracking apertado de -2%, peso 600–700), Inter para corpo e texto de interface, Geist Mono para código/tokens. Tipografia grande, altura de linha generosa (1.5–1.7 no corpo, 1.1 no display).
- **Espaçamento:** unidade base de 4px; seções respiram com 80–96px de padding vertical; cards usam 20–32px de padding interno. Espaço em branco generoso em detrimento de densidade, exceto em tabelas de dados/dashboards, onde as linhas ficam mais compactas (12–14px de padding).
- **Raio:** suave e consistente — 8px em controles pequenos, 12px padrão (inputs, tags), 16px em cards, 24px em superfícies grandes (painéis de hero, diálogos, card de preço em destaque). Nunca cantos retos, nunca um único raio exageradamente grande.
- **Sombras:** mínimas e suaves — uma borda de 1px faz a maior parte do trabalho de separação; a sombra é um leve realce (2–4% de opacidade preta desfocada), reservada para estados de hover, diálogos e o plano de preço em destaque. Nunca sombras duras.
- **Bordas:** 1px, zinc-200 (claro) / zinc-800 (escuro) — a principal forma de separar superfícies, mais do que sombra.
- **Movimento:** estilo Framer Motion — fade + slide-up na entrada, ease-out (cubic-bezier 0.16,1,0.3,1), 120–360ms. Easing spring reservado para pequenos feedbacks interativos (thumb do switch, elevação de botão), nunca para conteúdo de página. Sem loops decorativos infinitos, sem bounce em texto.
- **Hover/press:** hover = elevação de 1px + leve aumento de brilho em botões preenchidos, tingimento de fundo em itens ghost/nav; press não tem tratamento separado além da easing de transição já existente. Foco = um anel suave de brilho índigo de 4px, nunca um outline duro.
- **Fundos:** branco/zinc-50 chapado por padrão; um gradiente radial mesh suave de dois pontos apenas atrás de seções de hero. Sem fotografia, sem ilustração, sem textura/grão — este é um sistema focado em UI, sem ilustração.
- **Imagens:** nenhuma fornecida ou inventada — os blocos de logo na faixa "amado por" do kit de marketing são apenas wordmarks, não fotos ou logos ilustrados.
- **Transparência/blur:** usado na navbar fixa (branco translúcido + backdrop-blur) e em scrims de modal (overlay escuro desfocado) — os dois lugares onde o blur sinaliza "flutuando sobre o conteúdo."
- **Cards:** borda suave de 1px, raio de 12–16px, sombra-xs mínima em repouso, sombra-md + elevação de 2px no hover quando interativo.

## Iconografia

O briefing especifica **apenas ícones Lucide**. Nenhuma fonte de ícones, sprite sheet ou conjunto de SVG personalizado foi fornecido, então os UI kits carregam o Lucide diretamente do CDN (`unpkg.com/lucide`) e renderizam ícones via `data-lucide` + `lucide.createIcons()`. Sem emoji, sem ícones em glifo unicode (o ✓ usado nas listas de recursos dos cards de preço é pontuação simples, não substitui um ícone). Se a Candy Studio tiver um subconjunto de ícones customizado ou uma versão diferente fixada, atualize a URL do CDN no `index.html` de cada UI kit.

## Logo / marca

Nenhum arquivo de logo foi fornecido. Em todo lugar onde uma marca apareceria (navbar, footer, sidebar, avatares), o wordmark "Candy Studio" é renderizado em tipografia simples Geist/Inter — sem monograma ou marca-ícone inventados. Substitua pelo logo real (SVG preferencialmente) assim que estiver disponível; coloque em `assets/` e troque a prop `logo` no `App.jsx` de cada UI kit.

## Fontes

Inter, Geist e Geist Mono são carregadas diretamente do Google Fonts (`tokens/fonts.css`) — ambas são oficialmente publicadas lá, então nenhuma substituição foi necessária e nenhum arquivo de fonte local é empacotado.

## Índice

- `styles.css` — folha de estilo raiz, importa tudo abaixo.
- `tokens/` — `colors.css` (escalas índigo/violeta/ciano/zinc/verde/âmbar/vermelho + aliases semânticos), `typography.css`, `spacing.css`, `radius.css`, `shadows.css` (+ durações/easing de movimento), `fonts.css`.
- `guidelines/` — 12 cards de especificação de fundamentos (Cores ×4, Tipografia ×4, Espaçamento/Raio/Sombra/Movimento ×4) exibidos na aba Design System.
- `components/` — 31 primitivos React, agrupados por área:
  - `core/` — Button, IconButton
  - `forms/` — Input, Select, Checkbox, Radio, Switch, Textarea, FormField
  - `feedback/` — Badge, Tag, Toast, Tooltip, Dialog
  - `navigation/` — Navbar, Sidebar, Footer, Tabs, Pagination, Breadcrumb
  - `data/` — Card, StatCard, Table, BarChart, KanbanCard, Calendar
  - `marketing/` — Hero, PricingCard, FAQItem, Testimonial, TimelineItem

  **Adições intencionais** (não estão na lista literal de componentes do briefing, adicionadas porque as superfícies exigidas precisam delas): FormField (wrapper de label/hint/error para formulários com React Hook Form + Zod), Breadcrumb, Tabs, BarChart (um substituto leve em CSS para o Recharts, para que os layouts de dashboard tenham preview sem a biblioteca de gráficos real), StatCard, KanbanCard, TimelineItem, Tooltip — cada um citado explicitamente em "Componentes necessários" ou necessário para montar as seções obrigatórias de dashboard/CRM/preços/FAQ/timeline.
- `ui_kits/` — três superfícies interativas completas, compostas a partir dos componentes acima:
  - `marketing-site/` — landing page (navbar, hero, serviços, toggle de preços, depoimentos, FAQ em acordeão, footer)
  - `saas-dashboard/` — dashboard admin com sidebar + topbar (stat cards, gráfico de receita, mix de planos, tabela de clientes)
  - `crm-pipeline/` — pipeline de negócios em kanban (colunas de estágio, cards de negócio, estatísticas de pipeline)
- `SKILL.md` — ponto de entrada compatível com Claude Code / Agent Skills para este sistema.

## Ressalvas

- Nenhum arquivo do Figma, codebase ou logo foi anexado — este sistema foi criado inteiramente a partir do briefing escrito. Por favor, anexe o Figma/codebase real do produto e os assets de logo para que este sistema possa ser conciliado com a fonte real em vez de uma especificação.
- BarChart é um placeholder leve em CSS, não Recharts — substitua por componentes Recharts reais em produção, usando os mesmos tokens de cor.
- Pedido: revise a lista de componentes, o texto dos UI kits e os números de preços — todo o texto é ilustrativo e deve ser substituído pelo posicionamento real da Candy Studio.
