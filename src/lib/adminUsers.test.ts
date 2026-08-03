import { describe, expect, it } from "vitest";
import type { AdminPermissions } from "@/lib/adminUsers";
import { canAccessAdminSection } from "@/lib/adminUsers";

function buildPermissions(overrides: Partial<AdminPermissions> = {}): AdminPermissions {
  return {
    dashboard: false,
    banners: false,
    notificacoes: false,
    produtos: false,
    imagens: false,
    precos: false,
    pedidos: false,
    clientes: false,
    mensagens: false,
    usuarios: false,
    funcionarios: false,
    configuracoes: false,
    ...overrides,
  };
}

describe("admin section access", () => {
  it("keeps funcionarios hidden from a legacy admin without permissions json", () => {
    expect(
      canAccessAdminSection("funcionarios", {
        isSuperadmin: false,
        permissions: null,
      }),
    ).toBe(false);
  });

  it("lets a regular admin see funcionarios only when the permission is enabled", () => {
    expect(
      canAccessAdminSection("funcionarios", {
        isSuperadmin: false,
        permissions: buildPermissions({ funcionarios: true }),
      }),
    ).toBe(true);

    expect(
      canAccessAdminSection("funcionarios", {
        isSuperadmin: false,
        permissions: buildPermissions({ funcionarios: false }),
      }),
    ).toBe(false);
  });

  it("keeps usuarios reserved for superadmin", () => {
    expect(
      canAccessAdminSection("usuarios", {
        isSuperadmin: false,
        permissions: buildPermissions({ usuarios: true, funcionarios: true }),
      }),
    ).toBe(false);

    expect(
      canAccessAdminSection("usuarios", {
        isSuperadmin: true,
        permissions: buildPermissions({ usuarios: false }),
      }),
    ).toBe(true);
  });

  it("keeps the other admin sections working with the existing permissions map", () => {
    expect(
      canAccessAdminSection("produtos", {
        isSuperadmin: false,
        permissions: buildPermissions({ produtos: true }),
      }),
    ).toBe(true);

    expect(
      canAccessAdminSection("produtos", {
        isSuperadmin: false,
        permissions: buildPermissions({ produtos: false }),
      }),
    ).toBe(false);
  });
});
