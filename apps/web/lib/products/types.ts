export type ProductRow = {
  id: string;
  sku: string;
  nome: string;
  cmv: number;
  ativo: boolean;
  last_synced_at: string | null;
  fornecedor_id: string | null;
  supplier_name: string | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
  company_names: string | null;
  company_ids: string[];
};

export type NamedOption = { id: string; nome: string };

export function formatDimensions(p: Pick<ProductRow, 'altura' | 'largura' | 'profundidade'>) {
  if (!p.altura && !p.largura && !p.profundidade) return null;
  const n = (v: number | null) => (v ? Number(v).toLocaleString('pt-BR') : '–');
  return `${n(p.largura)} × ${n(p.altura)} × ${n(p.profundidade)} cm`;
}
