# Input

> Substitui o placeholder anterior de `formularios.md` — este é o componente
> formal de campo de formulário citado pelo brief de marca.

## Objetivo

Campo de entrada de dado consistente em qualquer formulário — contato do
site, candidatura, ou qualquer formulário do Business Platform (nova vaga,
nova oportunidade).

## Quando usar

Texto livre, e-mail, busca, seleção, textarea, checkbox, switch, radio,
upload — qualquer captura de dado do usuário.

## Quando não usar

Seleção de uma etapa de pipeline/status → `Badge` clicável ou controle
dedicado do Kanban, não um `<select>` genérico.

## Estados

Default, Focus (anel cyan — `--shadow-focus`), Error (borda vermelha +
mensagem de erro abaixo), Success (borda verde — confirmação em tempo real,
ex. e-mail validado), Disabled (fundo neutro, sem interação).

## Variações

Text field, select, textarea, checkbox, switch, radio, upload, search
(com ícone de lupa embutido), autocomplete (busca com sugestões — usado em
`/candidatos/busca` e Command Palette do Business Platform).

Borda 1px, `--radius-sm` (8px), foco troca borda para cyan + anel de foco.

## Exemplos

`Cargo desejado` (placeholder, default); `Executive Search` (focado, anel
cyan); `email@invalido` com "Email inválido" abaixo (error); `Buscar
talentos…` (search).

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Input.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Todo campo tem `<label>` associado (nunca só placeholder como label);
navegação completa por teclado; mensagem de erro anunciada via
`aria-describedby`; mensagem de erro segue tom de `docs/marca/tom-de-voz.md`
— direta, sem jargão técnico ("Email inválido", não "Erro de validação:
regex mismatch").
