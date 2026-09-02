import { Input, Select, FieldGroup } from '@/components/ui/Field';

export type ItemFieldsValue = {
  sku?: string | number | null;
  nome_produto?: string | number | null;
  quantidade?: string | number | null;
  fornecedor_origem_id?: string | number | null;
  cmv_unitario?: string | number | null;
  peso?: string | number | null;
  altura?: string | number | null;
  largura?: string | number | null;
  profundidade?: string | number | null;
  data_prevista_recebimento?: string | number | null;
  data_real_recebimento?: string | number | null;
  status_item?: string | number | null;
  observacao?: string | number | null;
};

export function LoadItemFields({
  value,
  onChange,
  suppliers,
  showFinancial,
}: {
  value: ItemFieldsValue;
  onChange: (field: keyof ItemFieldsValue, value: string) => void;
  suppliers: { id: string; nome: string }[];
  showFinancial: boolean;
}) {
  const str = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <FieldGroup label="SKU">
        <Input value={str(value.sku)} onChange={(e) => onChange('sku', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Nome do produto" className="md:col-span-2">
        <Input value={str(value.nome_produto)} onChange={(e) => onChange('nome_produto', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Quantidade">
        <Input type="number" value={str(value.quantidade)} onChange={(e) => onChange('quantidade', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Fornecedor / origem">
        <Select value={str(value.fornecedor_origem_id)} onChange={(e) => onChange('fornecedor_origem_id', e.target.value)}>
          <option value="">Selecionar</option>
          {suppliers.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Select>
      </FieldGroup>
      {showFinancial && (
        <FieldGroup label="CMV unitário">
          <Input type="number" value={str(value.cmv_unitario)} onChange={(e) => onChange('cmv_unitario', e.target.value)} />
        </FieldGroup>
      )}
      <FieldGroup label="Peso (kg)">
        <Input type="number" value={str(value.peso)} onChange={(e) => onChange('peso', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Altura (cm)">
        <Input type="number" value={str(value.altura)} onChange={(e) => onChange('altura', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Largura (cm)">
        <Input type="number" value={str(value.largura)} onChange={(e) => onChange('largura', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Profundidade (cm)">
        <Input type="number" value={str(value.profundidade)} onChange={(e) => onChange('profundidade', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Previsão de recebimento">
        <Input type="datetime-local" value={str(value.data_prevista_recebimento)} onChange={(e) => onChange('data_prevista_recebimento', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Recebimento real">
        <Input type="datetime-local" value={str(value.data_real_recebimento)} onChange={(e) => onChange('data_real_recebimento', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Status do item">
        <Input value={str(value.status_item)} onChange={(e) => onChange('status_item', e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Observação">
        <Input value={str(value.observacao)} onChange={(e) => onChange('observacao', e.target.value)} />
      </FieldGroup>
    </div>
  );
}
