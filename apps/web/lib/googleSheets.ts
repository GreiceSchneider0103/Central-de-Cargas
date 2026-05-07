import { google } from 'googleapis';

export type SheetProductRow = {
  sku: string;
  nome: string;
  cmv: number;
};

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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetsId, range });
  const values = response.data.values ?? [];

  if (!values.length) return [];

  const [header, ...rows] = values;
  const skuIndex = header.findIndex((h) => h.trim().toLowerCase() === 'sku');
  const nameIndex = header.findIndex((h) => h.trim().toLowerCase() === 'nome do produto');
  const cmvIndex = header.findIndex((h) => h.trim().toLowerCase() === 'cmv');

  if (skuIndex < 0 || nameIndex < 0 || cmvIndex < 0) {
    throw new Error('Cabeçalhos esperados não encontrados. Use: SKU | Nome do produto | CMV');
  }

  return rows
    .map((row) => {
      const sku = (row[skuIndex] ?? '').trim();
      const nome = (row[nameIndex] ?? '').trim();
      const cmvRaw = (row[cmvIndex] ?? '').toString().replace(',', '.').trim();
      const cmv = Number(cmvRaw || '0');
      return { sku, nome, cmv: Number.isFinite(cmv) ? cmv : 0 };
    })
    .filter((r) => r.sku && r.nome);
}
