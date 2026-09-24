import type { WorkBook } from 'xlsx';

export type ImportProductRow = {
  sku: string;
  nome: string;
  cmv: number | null;
  fornecedor: string | null;
};

export type ParsedProductSheet = {
  rows: ImportProductRow[];
  totalRows: number;
  skippedParents: number;
  skippedInvalid: number;
};

// Cabeçalhos aceitos (sem acento, minúsculos). Cobre a exportação de
// produtos do Olist/Tiny e planilhas simples com SKU / Nome / CMV.
const HEADERS = {
  sku: ['codigo (sku)', 'sku', 'codigo'],
  nome: ['descricao', 'nome', 'produto', 'nome do produto'],
  cmv: ['preco de custo', 'cmv', 'custo'],
  fornecedor: ['fornecedor'],
  tipo: ['tipo do produto'],
};

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  // "1.234,56" (pt-BR) ou "1234.56"
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseProductWorkbook(workbook: WorkBook, utils: typeof import('xlsx').utils): ParsedProductSheet {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('SPREADSHEET_EMPTY');

  // raw: valores numéricos de verdade (CMV); text: como aparecem na planilha,
  // para SKUs numéricos longos não perderem precisão.
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const text = utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
  if (raw.length === 0) throw new Error('SPREADSHEET_EMPTY');

  const columns = Object.keys(raw[0]);
  const find = (options: string[]) => columns.find((c) => options.includes(normalizeHeader(c)));
  const col = {
    sku: find(HEADERS.sku),
    nome: find(HEADERS.nome),
    cmv: find(HEADERS.cmv),
    fornecedor: find(HEADERS.fornecedor),
    tipo: find(HEADERS.tipo),
  };

  const skuCol = col.sku;
  const nomeCol = col.nome;
  if (!skuCol || !nomeCol) throw new Error('SPREADSHEET_MISSING_COLUMNS');

  const rows: ImportProductRow[] = [];
  let skippedParents = 0;
  let skippedInvalid = 0;

  raw.forEach((r, index) => {
    const t = text[index] ?? {};
    // Olist: "V" é o produto pai das variações (só agrupa, não tem custo nem
    // é enviado). As variações vêm como linhas próprias.
    if (col.tipo && String(r[col.tipo]).trim().toUpperCase() === 'V') {
      skippedParents += 1;
      return;
    }

    const sku = String(t[skuCol] ?? '').trim();
    const nome = String(t[nomeCol] ?? '').trim();
    if (!sku || !nome) {
      skippedInvalid += 1;
      return;
    }

    rows.push({
      sku,
      nome,
      cmv: col.cmv ? toNumber(r[col.cmv]) : null,
      fornecedor: col.fornecedor ? String(t[col.fornecedor] ?? '').trim() || null : null,
    });
  });

  return { rows, totalRows: raw.length, skippedParents, skippedInvalid };
}
