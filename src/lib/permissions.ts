/** Módulos do sistema ELO com controle de permissão. */
export const MODULES = [
  { key: "viagens", label: "Viagens" },
  { key: "crm", label: "CRM" },
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export type ModulePermission = {
  view: boolean;
  edit: boolean;
  delete: boolean;
};

export type PermissionMap = Partial<Record<string, ModulePermission>>;

export const EMPTY_PERMISSION: ModulePermission = {
  view: false,
  edit: false,
  delete: false,
};

export function normalizePermissions(raw: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [modulo, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = (value ?? {}) as Record<string, unknown>;
    out[modulo] = {
      view: Boolean(v.view),
      edit: Boolean(v.edit),
      delete: Boolean(v.delete),
    };
  }
  return out;
}
