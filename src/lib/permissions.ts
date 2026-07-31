export const MODULES = [
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type AppRole = "admin" | "usuario";

export type PermissionRow = {
  user_id: string;
  modulo: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type ManagedUser = {
  id: string;
  email: string | null;
  nome: string | null;
  ativo: boolean;
  role: AppRole;
  permissions: Record<string, PermissionRow>;
};
