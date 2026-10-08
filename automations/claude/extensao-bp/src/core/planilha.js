/**
 * Planilhas sem dependências: gera .xlsx (modelo para download) e lê .xlsx
 * e .csv (importação). O .xlsx é um zip de XMLs; o zip é montado aqui (sem
 * compressão) e lido com o DecompressionStream nativo do Chrome.
 */

// ─── ZIP ───────────────────────────────────────────────────────────────────

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip "store" (sem compressão): [{ nome, texto }] → Blob. */
function zip(arquivos, mime) {
  const enc = new TextEncoder();
  const partes = [];
  const central = [];
  let offset = 0;
  for (const { nome, texto } of arquivos) {
    const dados = enc.encode(texto);
    const nomeB = enc.encode(nome);
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeB.length, true);
    partes.push(local.buffer, nomeB, dados);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dados.length, true);
    c.setUint32(24, dados.length, true);
    c.setUint16(28, nomeB.length, true);
    c.setUint32(42, offset, true);
    central.push(c.buffer, nomeB);
    offset += 30 + nomeB.length + dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.byteLength, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  return new Blob([...partes, ...central, fim.buffer], { type: mime });
}

/** Lê um zip: Map(nome → texto). Aceita "store" e "deflate". */
async function unzip(buffer) {
  const v = new DataView(buffer);
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("zip inválido");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const saida = new Map();
  for (let k = 0; k < total; k++) {
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true);
    const xLen = v.getUint16(p + 30, true);
    const cLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const nome = dec.decode(new Uint8Array(buffer, p + 46, nLen));
    p += 46 + nLen + xLen + cLen;
    if (!/\.(xml|rels)$/.test(nome)) continue;
    const ini = localOff + 30 + v.getUint16(localOff + 26, true) + v.getUint16(localOff + 28, true);
    const bruto = new Uint8Array(buffer, ini, comprimido);
    let bytes = bruto;
    if (metodo === 8) {
      const stream = new Blob([bruto]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else if (metodo !== 0) continue;
    saida.set(nome, dec.decode(bytes));
  }
  return saida;
}

// ─── XLSX ──────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colLetra = (i) => (i >= 26 ? colLetra(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

/**
 * Gera um .xlsx. abas: [{ nome, linhas: [[célula]], larguras?: [n], cabecalho?: true, texto?: [colunas como texto] }].
 * Estilos: 0 normal · 1 cabeçalho (negrito, fundo) · 2 texto (@) · 3 título.
 */
export function gerarXlsx(abas) {
  const sheets = abas.map((aba, a) => {
    const linhas = aba.linhas
      .map((linha, r) => {
        const cel = linha
          .map((v, c) => {
            const estilo = aba.cabecalho && r === 0 ? 1 : aba.titulo && r === 0 ? 3 : aba.texto?.includes(c) ? 2 : 0;
            if (v == null || v === "") return estilo ? `<c r="${colLetra(c)}${r + 1}" s="${estilo}"/>` : "";
            return `<c r="${colLetra(c)}${r + 1}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cel}</row>`;
      })
      .join("");
    // Linhas vazias com estilo de texto nas colunas indicadas (telefone não vira número).
    const vazias = aba.texto?.length
      ? Array.from({ length: 1000 }, (_, k) => {
          const r = aba.linhas.length + k + 1;
          return `<row r="${r}">${aba.texto.map((c) => `<c r="${colLetra(c)}${r}" s="2"/>`).join("")}</row>`;
        }).join("")
      : "";
    const cols = aba.larguras ? `<cols>${aba.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${aba.texto?.includes(i) ? ' style="2"' : ""}/>`).join("")}</cols>` : "";
    const congelar = aba.cabecalho ? '<sheetViews><sheetView workbookViewId="0"' + (a === 0 ? ' tabSelected="1"' : "") + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${congelar}${cols}<sheetData>${linhas}${vazias}</sheetData></worksheet>`;
  });
  const arquivos = [
    {
      nome: "[Content_Types].xml",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    },
    { nome: "_rels/.rels", texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    {
      nome: "xl/workbook.xml",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${esc(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      nome: "xl/styles.xml",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF383A47"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E7AB8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="49" applyNumberFormat="1"/><xf fontId="2" applyFont="1"/></cellXfs></styleSheet>`,
    },
    ...sheets.map((texto, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, texto })),
  ];
  return zip(arquivos, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/** Primeira aba de um .xlsx como matriz de textos. */
async function lerXlsx(buffer) {
  const arquivos = await unzip(buffer);
  // Busca pelo nome local, com ou sem prefixo de namespace: o Numbers e o
  // Google Planilhas gravam <x:row>, <x:c>…; o Excel grava <row>, <c>.
  const tags = (no, nome) => [...no.getElementsByTagNameNS("*", nome)];
  const xml = (nome) => (arquivos.has(nome) ? new DOMParser().parseFromString(arquivos.get(nome), "application/xml") : null);
  const textoDe = (no) => tags(no, "t").map((t) => t.textContent).join("");
  const compartilhadas = (() => { const ss = xml("xl/sharedStrings.xml"); return ss ? tags(ss, "si").map(textoDe) : []; })();
  // Primeira aba pela ordem do workbook.
  const wb = xml("xl/workbook.xml");
  const rels = xml("xl/_rels/workbook.xml.rels");
  const primeira = wb ? tags(wb, "sheet")[0] : null;
  const rid = primeira?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? primeira?.getAttribute("r:id");
  const alvo = (rels ? tags(rels, "Relationship") : []).find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;
  const folha = xml(caminho);
  if (!folha) throw new Error("planilha sem abas");
  const linhas = [];
  for (const row of tags(folha, "row")) {
    const linha = [];
    for (const c of tags(row, "c")) {
      const ref = c.getAttribute("r") ?? "";
      const col = [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const tipo = c.getAttribute("t");
      const v = tags(c, "v")[0]?.textContent ?? "";
      let valor = tipo === "s" ? compartilhadas[Number(v)] ?? "" : tipo === "inlineStr" ? textoDe(c) : v;
      // Número inteiro grande (telefone digitado como número): sem notação científica.
      if (!tipo && /e\+?\d+$/i.test(valor)) valor = BigInt(Math.round(Number(valor))).toString();
      linha[col >= 0 ? col : linha.length] = valor;
    }
    linhas.push(Array.from(linha, (x) => (x ?? "").trim()));
  }
  return linhas;
}

/** CSV com ";" ou "," (aspas, quebras de linha entre aspas e BOM). */
function lerCsv(texto) {
  texto = texto.replace(/^﻿/, "");
  const primeira = texto.split(/\r?\n/)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo.trim());
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo.trim());
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) linhas.push([...linha, campo.trim()]);
  return linhas;
}

/** Lê .xlsx ou .csv e devolve a matriz de textos (linhas vazias removidas). */
export async function lerPlanilha(file) {
  const nome = file.name.toLowerCase();
  let linhas;
  if (nome.endsWith(".xlsx")) linhas = await lerXlsx(await file.arrayBuffer());
  else if (nome.endsWith(".csv") || nome.endsWith(".txt")) linhas = lerCsv(await file.text());
  else throw new Error("formato");
  return linhas.filter((l) => l.some((c) => c));
}
