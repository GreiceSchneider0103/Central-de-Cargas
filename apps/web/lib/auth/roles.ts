export const USER_PROFILES = [
  'admin',
  'gerente_estoque',
  'gerente_ecommerce',
  'vendedor_loja',
  'operador_carga',
  'financeiro',
] as const;

export type UserProfileRole = (typeof USER_PROFILES)[number];

export type UserProfile = {
  id: string;
  auth_user_id: string;
  nome: string | null;
  email: string | null;
  perfil: UserProfileRole;
  loja_id: string | null;
  empresa_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const MENU_BY_ROLE: Record<UserProfileRole, string[]> = {
  admin: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/relatorios', '/auditoria', '/usuarios', '/cadastros'],
  gerente_estoque: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/relatorios', '/auditoria', '/cadastros'],
  gerente_ecommerce: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/relatorios', '/cadastros'],
  vendedor_loja: ['/', '/solicitacoes', '/relatorios', '/cadastros'],
  operador_carga: ['/', '/agenda', '/cargas', '/relatorios', '/cadastros'],
  financeiro: ['/', '/cargas', '/relatorios', '/auditoria', '/cadastros'],
};
