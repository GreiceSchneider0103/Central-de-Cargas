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
  admin: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/usuarios', '/cadastros'],
<<<<<<< codex/analyze-repository-structure-and-components-argnnz
  gerente_estoque: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/cadastros'],
  gerente_ecommerce: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos', '/cadastros'],
  vendedor_loja: ['/', '/solicitacoes', '/cadastros'],
  operador_carga: ['/', '/agenda', '/cargas', '/cadastros'],
  financeiro: ['/', '/cargas', '/cadastros'],
=======
  gerente_estoque: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos'],
  gerente_ecommerce: ['/', '/agenda', '/solicitacoes', '/cargas', '/produtos'],
  vendedor_loja: ['/', '/solicitacoes'],
  operador_carga: ['/', '/agenda', '/cargas'],
  financeiro: ['/', '/cargas'],
>>>>>>> main
};
