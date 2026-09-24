'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { parseProductWorkbook, type ParsedProductSheet } from '@/lib/products/spreadsheet';

export type CompanyOption = { id: string; nome: string };

const CHUNK_SIZE = 1000;

export function ProductImportDialog({ open, onClose, companies }: { open: boolean; onClose: () => void; companies: CompanyOption[] }) {
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedProductSheet | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function toggleCompany(id: string) {
    setCompanyIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function reset() {
    setCompanyIds([]);
    setFileName('');
    setParsed(null);
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    setParsed(null);
    setFileName(file?.name ?? '');
    if (!file) return;
    setReading(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const result = parseProductWorkbook(workbook, XLSX.utils);
      if (result.rows.length === 0) throw new Error('SPREADSHEET_NO_PRODUCTS');
      setParsed(result);
    } catch (error) {
      toast.error(translateError(error instanceof Error ? error.message : undefined, 'Não foi possível ler a planilha.'));
      setFileName('');
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (!parsed || companyIds.length === 0) return;
    setImporting(true);
    const supabase = createClient();
    const totals = { created: 0, updated: 0, linked: 0 };

    for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
      const { data, error } = await supabase.rpc('import_products_for_companies', {
        p_company_ids: companyIds,
        p_rows: parsed.rows.slice(i, i + CHUNK_SIZE),
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
      description="Aceita a exportação de produtos do Olist (.xls) ou uma planilha com as colunas SKU, Nome e CMV."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={importing}>Cancelar</Button>
          <Button variant="primary" onClick={handleImport} disabled={!parsed || companyIds.length === 0 || importing}>
            <Upload className="h-4 w-4" />
            {importing ? 'Importando...' : `Importar ${parsed?.rows.length ?? ''} produtos`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldGroup label={`Empresas${companyIds.length > 0 ? ` (${companyIds.length} selecionada${companyIds.length > 1 ? 's' : ''})` : ''}`}>
          <div className="grid grid-cols-1 gap-1 rounded-lg border border-zinc-300 p-2 sm:grid-cols-2">
            {companies.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 accent-brand-600"
                  checked={companyIds.includes(c.id)}
                  onChange={() => toggleCompany(c.id)}
                  disabled={importing}
                />
                {c.nome}
              </label>
            ))}
          </div>
          {companies.length > 1 && (
            <button
              type="button"
              className="self-start text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
              disabled={importing}
              onClick={() => setCompanyIds(companyIds.length === companies.length ? [] : companies.map((c) => c.id))}
            >
              {companyIds.length === companies.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          )}
        </FieldGroup>

        <FieldGroup label="Planilha">
          <Input
            type="file"
            accept=".xls,.xlsx,.csv"
            className="py-2 h-auto"
            disabled={importing || reading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </FieldGroup>

        {reading && <p className="text-sm text-zinc-500">Lendo {fileName}...</p>}

        {parsed && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="font-medium text-zinc-900">{fileName}</p>
            <ul className="mt-1 space-y-0.5">
              <li>{parsed.rows.length} produtos serão importados</li>
              {parsed.skippedParents > 0 && <li>{parsed.skippedParents} produtos pai de variação ignorados (as variações entram)</li>}
              {parsed.skippedInvalid > 0 && <li>{parsed.skippedInvalid} linhas sem SKU ou nome ignoradas</li>}
              <li>{parsed.rows.filter((r) => !r.cmv || r.cmv <= 0).length} sem preço de custo (mantêm o CMV já cadastrado, se houver)</li>
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
