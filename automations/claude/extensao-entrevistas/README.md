# Find4You · Registro de Entrevistas (extensão Chrome)

Painel lateral do Chrome em que o recrutador cola a transcrição da entrevista
e os dados da vaga, e recebe um registro estruturado nas 11 seções do schema
`analyze_interview`: resumo executivo, experiências, aderência a requisitos,
competências, motivação, disponibilidade, expectativa salarial, pontos
positivos, pontos de atenção e resumo final. O registro é apoio à
documentação, nunca avaliação, nota ou decisão.

Independente do Candydate (`matchwork/chrome-extension/`): não captura áudio,
não tem login nem backend. Chama a API da Anthropic direto do navegador com
a chave do próprio recrutador.

## O que existe aqui

| Caminho | Conteúdo |
|---|---|
| `src/schema.js` | Definição canônica `analyze_interview` e conversão para saída estruturada |
| `src/prompt.js` | Regras do registro (system prompt) e montagem da mensagem |
| `src/analyze.js` | Chamada ao Claude (`claude-opus-5`, raciocínio adaptativo, streaming, fallback em recusa) |
| `src/render.js` | Renderização no painel e exportação em Markdown |
| `src/sidepanel.js`, `src/options.js` | Lógica do painel e da tela de configurações |
| `extension/` | Pasta carregada no Chrome (manifest, HTML, CSS, ícones, `dist/` gerado) |

## Instalação

```bash
npm install
npm run build
```

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta `extension/`.
3. A tela de configurações abre sozinha: cole uma chave de API da Anthropic
   (console.anthropic.com → API Keys).
4. Clique no ícone da extensão para abrir o painel lateral.

Após alterar algo em `src/`, rode `npm run build` (ou `npm run watch`) e
clique em recarregar no card da extensão em `chrome://extensions`.

## Privacidade e segurança

- A chave fica em `chrome.storage.local`, só no navegador do recrutador. Use
  uma chave dedicada, com limite de gasto definido no Console da Anthropic.
- A transcrição só é enviada a `api.anthropic.com` ao clicar em "Gerar
  registro".
- Rascunho e último registro ficam em `chrome.storage.session`, que o Chrome
  apaga quando é fechado.
