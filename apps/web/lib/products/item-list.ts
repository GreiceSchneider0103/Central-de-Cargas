import type { WorkBook } from 'xlsx';

export type SkuQuantity = { sku: string; quantidade: number };

function toQuantity(value: unknown) {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// "SKU<tab|;|,>quantidade" ou "SKU quantidade" por linha (colado do Excel).
// Linhas sem quantidade válida (ex.: cabeçalho) são ignoradas.
export function parseItemsText(text: string): SkuQuantity[] {
  const result: SkuQuantity[] = [];
  for (const line of text.split(/\r?\n/)) {
    let parts = line.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const quantidade = toQuantity(parts[parts.length - 1]);
    const sku = parts[0];
    if (sku && quantidade) result.push({ sku, quantidade });
  }
  return result;
}

const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const SKU_HEADERS = ['sku', 'codigo (sku)', 'codigo', 'cod', 'codigo sku'];
const QTY_HEADERS = ['quantidade', 'qtd', 'qtde', 'quant', 'qty'];

// Planilha com colunas SKU e Quantidade (primeira aba).
export function parseItemsWorkbook(workbook: WorkBook, utils: typeof import('xlsx').utils): SkuQuantity[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('SPREADSHEET_EMPTY');
  const rows = utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
  if (rows.length === 0) throw new Error('SPREADSHEET_EMPTY');
  const columns = Object.keys(rows[0]);
  const skuCol = columns.find((c) => SKU_HEADERS.includes(normalize(c)));
  const qtyCol = columns.find((c) => QTY_HEADERS.includes(normalize(c)));
  if (!skuCol || !qtyCol) throw new Error('ITEMS_SPREADSHEET_MISSING_COLUMNS');
  return rows
    .map((r) => ({ sku: String(r[skuCol] ?? '').trim(), quantidade: toQuantity(r[qtyCol]) }))
    .filter((r): r is SkuQuantity => Boolean(r.sku) && r.quantidade != null);
}
