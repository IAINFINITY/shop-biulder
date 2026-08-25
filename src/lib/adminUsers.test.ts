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

describe("quando as permissões não carregam", () => {
  /**
   * O caso real de 25/08/2026, e o motivo de ele ter passado despercebido.
   *
   * A policy de RLS de `clinic+b2b_admin_users` só deixava o superadmin ler a
   * tabela — nem a própria linha um admin comum enxergava. A consulta do painel
   * falhava, `adminPermissions` ficava `undefined`, e este é o resultado:
   *
   *   - todas as seções aparecem, porque `!permissions` vale acesso completo;
   *   - **só** `funcionarios` some, porque é a única que exige a permissão
   *     explícita.
   *
   * Um admin com tudo marcado via tudo menos Funcionários, e o sistema de
   * permissões inteiro estava inerte sem ninguém notar. A policy foi corrigida
   * na migration `20260825140000`; este teste registra a assinatura da falha,
   * para que ela seja reconhecível se voltar por outro caminho.
   */
  it("`undefined` libera tudo, menos funcionarios e usuarios", () => {
    const semPermissoes = { isSuperadmin: false, permissions: undefined };

    expect(canAccessAdminSection("produtos", semPermissoes)).toBe(true);
    expect(canAccessAdminSection("precos", semPermissoes)).toBe(true);
    expect(canAccessAdminSection("clientes", semPermissoes)).toBe(true);

    // A assinatura do sintoma: estas duas são as únicas que somem.
    expect(canAccessAdminSection("funcionarios", semPermissoes)).toBe(false);
    expect(canAccessAdminSection("usuarios", semPermissoes)).toBe(false);
  });

  it("com a linha lida, a permissão marcada passa a valer", () => {
    // O que a correção entrega: o mesmo admin, agora com o dado em mãos.
    expect(
      canAccessAdminSection("funcionarios", {
        isSuperadmin: false,
        permissions: buildPermissions({ funcionarios: true }),
      }),
    ).toBe(true);
  });

  it("e o que estiver desmarcado passa a esconder de verdade", () => {
    /**
     * O outro lado, que vale avisar antes de subir: enquanto a leitura falhava,
     * caixa desmarcada não escondia nada. `comercial9@botta.com.br` está com
     * `precos: false` e enxerga Preços hoje. Depois da correção, não enxerga —
     * que é o que a configuração sempre disse.
     */
    expect(
      canAccessAdminSection("precos", {
        isSuperadmin: false,
        permissions: buildPermissions({ precos: false, produtos: true }),
      }),
    ).toBe(false);
  });
});
