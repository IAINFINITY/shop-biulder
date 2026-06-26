import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import type { CustomerProfile } from "@/lib/customerProfile";
import { DEFAULT_CUSTOMER_TYPE } from "@/lib/pricing";

const authMocks = vi.hoisted(() => {
  const state = {
    authCallback: null as null | ((event: string, session: { user?: { id: string; email?: string } } | null) => Promise<void> | void),
    profileQueue: [] as Array<Promise<{ data: CustomerProfile | null; error: null }>>,
  };

  const getSession = vi.fn();
  const rpc = vi.fn();
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => state.profileQueue.shift() ?? Promise.resolve({ data: null, error: null }),
      }),
    }),
  }));
  const onAuthStateChange = vi.fn((callback) => {
    state.authCallback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  return { state, getSession, rpc, from, onAuthStateChange };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: authMocks.rpc,
    from: authMocks.from,
  },
}));

function AuthProbe() {
  const { loading, user, isAdmin, customerProfile } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? ""}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="profile">{customerProfile?.company ?? ""}</span>
    </div>
  );
}

const hydratedProfile: CustomerProfile = {
  user_id: "admin-1",
  name: "Admin",
  phone: "11999999999",
  company: "Clinic Mais",
  cnpj: "12345678000199",
  customer_type: DEFAULT_CUSTOMER_TYPE,
  address_cep: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  address_ibge: "",
  created_at: "",
  updated_at: "",
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.state.authCallback = null;
    authMocks.state.profileQueue = [];
    try {
      window.sessionStorage.removeItem("clinicplus_auth_bootstrap");
    } catch {
      // ignore
    }
  });

  it("does not keep the auth gate blocked while the customer profile hydrates", async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-1", email: "admin@clinic.com" },
        },
      },
      error: null,
    });
    authMocks.rpc.mockResolvedValue({ data: true, error: null });

    let resolveProfile: (value: { data: CustomerProfile; error: null }) => void = () => {};
    const profilePromise = new Promise<{ data: CustomerProfile; error: null }>((resolve) => {
      resolveProfile = resolve;
    });
    authMocks.state.profileQueue.push(profilePromise);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("user")).toHaveTextContent("admin@clinic.com");
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
    expect(screen.getByTestId("profile")).toHaveTextContent("");

    resolveProfile({
      data: hydratedProfile,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile")).toHaveTextContent("Clinic Mais");
    });
  });

  it("does not flip loading back on a background auth refresh", async () => {
    const sessionUser = { id: "admin-1", email: "admin@clinic.com" };

    authMocks.getSession.mockResolvedValue({
      data: {
        session: { user: sessionUser },
      },
      error: null,
    });
    authMocks.rpc.mockResolvedValue({ data: true, error: null });
    authMocks.state.profileQueue.push(
      Promise.resolve({
        data: hydratedProfile,
        error: null,
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await act(async () => {
      await authMocks.state.authCallback?.("TOKEN_REFRESHED", { user: sessionUser });
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(authMocks.getSession).toHaveBeenCalledTimes(1);
    expect(authMocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("ignores transient auth null states while a session is already active", async () => {
    const sessionUser = { id: "admin-1", email: "admin@clinic.com" };

    authMocks.getSession.mockResolvedValue({
      data: {
        session: { user: sessionUser },
      },
      error: null,
    });
    authMocks.rpc.mockResolvedValue({ data: true, error: null });
    authMocks.state.profileQueue.push(
      Promise.resolve({
        data: hydratedProfile,
        error: null,
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await act(async () => {
      await authMocks.state.authCallback?.("INITIAL_SESSION", null);
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("admin@clinic.com");
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
  });
});
