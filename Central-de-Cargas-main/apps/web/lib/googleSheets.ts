import { google } from 'googleapis';

export type SheetProductRow = {
  sku: string;
  nome: string;
  cmv: number;
};

const normalize = (text: string) => text.trim().toLowerCase();

function parseBrazilianCurrency(value: unknown): number {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace('R$', '');

  if (!raw) return 0;

  const normalized = raw
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchProductsFromGoogleSheets(): Promise<SheetProductRow[]> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!sheetsId || !range || !serviceAccountEmail || !privateKey) {
    throw new Error('Configuração do Google Sheets incompleta. Verifique variáveis de ambiente.');
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range,
  });

  const values = response.data.values ?? [];

  if (!values.length) return [];

  const [header, ...rows] = values;
  const normalizedHeader = header.map((h) => normalize(String(h)));

  const skuIndex = normalizedHeader.findIndex((h) => h === 'sku');
  const nameIndex = normalizedHeader.findIndex(
    (h) => h === 'nome do produto' || h === 'nome' || h === 'produto'
  );
  const cmvIndex = normalizedHeader.findIndex((h) => h === 'cmv');

  if (skuIndex < 0 || nameIndex < 0 || cmvIndex < 0) {
    throw new Error('Cabeçalhos esperados não encontrados. Use: SKU | Nome do produto | CMV');
  }

  return rows
    .map((row) => {
      const sku = (row[skuIndex] ?? '').toString().trim();
      const nome = (row[nameIndex] ?? '').toString().trim();
      const cmv = parseBrazilianCurrency(row[cmvIndex]);

      return { sku, nome, cmv };
    })
    .filter((r) => r.sku && r.nome);
}
