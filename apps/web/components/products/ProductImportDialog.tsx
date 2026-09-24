'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { parseProductWorkbook, type ParsedProductSheet } from '@/lib/products/spreadsheet';

export type CompanyOption = { id: string; nome: string };

const CHUNK_SIZE = 1000;

export function ProductImportDialog({ open, onClose, companies }: { open: boolean; onClose: () => void; companies: CompanyOption[] }) {
  const [companyId, setCompanyId] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedProductSheet | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function reset() {
    setCompanyId('');
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
    if (!parsed || !companyId) return;
    setImporting(true);
    const supabase = createClient();
    const totals = { created: 0, updated: 0, linked: 0 };

    for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
      const { data, error } = await supabase.rpc('import_products_for_company', {
        p_company_id: companyId,
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

    const companyName = companies.find((c) => c.id === companyId)?.nome ?? 'a empresa';
    toast.success(`Importação concluída: ${totals.created} criados, ${totals.updated} atualizados, ${totals.linked} novos vínculos com ${companyName}.`);
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
          <Button variant="primary" onClick={handleImport} disabled={!parsed || !companyId || importing}>
            <Upload className="h-4 w-4" />
            {importing ? 'Importando...' : `Importar ${parsed?.rows.length ?? ''} produtos`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldGroup label="Empresa">
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={importing}>
            <option value="">Selecione a empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
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
              SKUs que já existem são atualizados e ganham o vínculo com a empresa escolhida, sem perder os vínculos com outras empresas.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
