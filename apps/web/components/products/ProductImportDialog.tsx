'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { CompanyCheckboxes } from './CompanyCheckboxes';
import { mergeProductRows, parseProductWorkbook, type ImportProductRow, type ParsedProductSheet } from '@/lib/products/spreadsheet';

import type { NamedOption } from '@/lib/products/types';

export type CompanyOption = NamedOption;

const CHUNK_SIZE = 1000;

type SheetFile = { key: string; name: string; parsed: ParsedProductSheet };

export function ProductImportDialog({ open, onClose, companies }: { open: boolean; onClose: () => void; companies: CompanyOption[] }) {
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [files, setFiles] = useState<SheetFile[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function reset() {
    setCompanyIds([]);
    setFiles([]);
    setInputKey((k) => k + 1);
  }

  const { rows, duplicates } = mergeProductRows(files.map((f) => f.parsed.rows));
  const count = (predicate: (r: ImportProductRow) => boolean) => rows.filter(predicate).length;
  const skippedParents = files.reduce((sum, f) => sum + f.parsed.skippedParents, 0);
  const skippedInvalid = files.reduce((sum, f) => sum + f.parsed.skippedInvalid, 0);

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFiles(list: FileList | null) {
    const selected = Array.from(list ?? []);
    setInputKey((k) => k + 1);
    if (selected.length === 0) return;
    const XLSX = await import('xlsx');
    const added: SheetFile[] = [];
    for (const file of selected) {
      setReading(file.name);
      try {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const result = parseProductWorkbook(workbook, XLSX.utils);
        if (result.rows.length === 0) throw new Error('SPREADSHEET_NO_PRODUCTS');
        added.push({ key: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, parsed: result });
      } catch (error) {
        toast.error(`${file.name}: ${translateError(error instanceof Error ? error.message : undefined, 'não foi possível ler a planilha.')}`);
      }
    }
    setReading(null);
    // Selecionar de novo o mesmo arquivo substitui a leitura anterior.
    setFiles((prev) => [...prev.filter((f) => !added.some((a) => a.key === f.key)), ...added]);
  }

  async function handleImport() {
    if (rows.length === 0 || companyIds.length === 0) return;
    setImporting(true);
    const supabase = createClient();
    const totals = { created: 0, updated: 0, linked: 0 };

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const { data, error } = await supabase.rpc('import_products_for_companies', {
        p_company_ids: companyIds,
        p_rows: rows.slice(i, i + CHUNK_SIZE),
      });
      if (error) {
        toast.error(translateError(error.message, 'Erro ao importar a planilha.'));
        setImporting(false);
        if (i > 0) router.refresh();
        return;
      }
      const result = (data as { created: number; updated: number; linked: number }[] | null)?.[0];
      totals.created += result?.created ?? 0;
      totals.updated += result?.updated ?? 0;
      totals.linked += result?.linked ?? 0;
    }

    const target = companyIds.length === 1 ? (companies.find((c) => c.id === companyIds[0])?.nome ?? 'a empresa') : `${companyIds.length} empresas`;
    toast.success(`Importação concluída: ${totals.created} criados, ${totals.updated} atualizados, ${totals.linked} novos vínculos com ${target}.`);
    setImporting(false);
    reset();
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Importar produtos por planilha"
      description="Aceita uma ou mais exportações de produtos do Olist (.xls) ou planilhas com as colunas SKU, Nome e CMV."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={importing}>Cancelar</Button>
          <Button variant="primary" onClick={handleImport} disabled={rows.length === 0 || companyIds.length === 0 || importing || reading !== null}>
            <Upload className="h-4 w-4" />
            {importing ? 'Importando...' : `Importar ${rows.length || ''} produtos`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldGroup label={`Empresas${companyIds.length > 0 ? ` (${companyIds.length} selecionada${companyIds.length > 1 ? 's' : ''})` : ''}`}>
          <CompanyCheckboxes companies={companies} value={companyIds} onChange={setCompanyIds} disabled={importing} />
        </FieldGroup>

        <FieldGroup label="Planilhas">
          <Input
            key={inputKey}
            type="file"
            multiple
            accept=".xls,.xlsx,.csv"
            className="py-2 h-auto"
            disabled={importing || reading !== null}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="text-xs text-zinc-500">Selecione vários arquivos de uma vez ou adicione mais depois.</span>
        </FieldGroup>

        {reading && <p className="text-sm text-zinc-500">Lendo {reading}...</p>}

        {files.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
            {files.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-zinc-800">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-zinc-500">
                  {f.parsed.rows.length} produtos
                  <button
                    type="button"
                    aria-label={`Remover ${f.name}`}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-40"
                    disabled={importing}
                    onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <ul className="space-y-0.5">
              <li className="font-medium text-zinc-900">{rows.length} produtos serão importados{files.length > 1 ? ` de ${files.length} planilhas` : ''}</li>
              {duplicates > 0 && <li>{duplicates} SKUs repetidos entre as planilhas foram juntados</li>}
              {skippedParents > 0 && <li>{skippedParents} produtos pai de variação ignorados (as variações entram)</li>}
              {skippedInvalid > 0 && <li>{skippedInvalid} linhas sem SKU ou nome ignoradas</li>}
              <li>{count((r) => !r.cmv || r.cmv <= 0)} sem preço de custo (mantêm o CMV já cadastrado, se houver)</li>
              <li>{count((r) => Boolean(r.peso || r.altura || r.largura || r.profundidade))} com peso ou medidas da embalagem</li>
              <li>{count((r) => Boolean(r.preco_venda))} com preço de venda</li>
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              SKUs que já existem são atualizados e ganham o vínculo com as empresas marcadas, sem perder os vínculos que já tinham.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
