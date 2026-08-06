import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { PublicLayout } from "@/components/layout/PublicLayout";
const Index = lazy(() => import("./pages/Index.tsx"));
const Admin = lazy(() => import("./pages/AdminWorkspace.tsx"));
const ProductDetails = lazy(() => import("./pages/ProductDetails.tsx"));
const OrderForm = lazy(() => import("./pages/OrderForm.tsx"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword.tsx"));
const Help = lazy(() => import("./pages/Help.tsx"));
const Favoritos = lazy(() => import("./pages/Favoritos.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando página...</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

/**
 * Toda troca de rota comeca no topo — menos o catalogo.
 *
 * O navegador preserva a rolagem entre rotas, entao sair do meio do catalogo
 * para a Conta caia no meio da pagina nova, sem cabecalho a vista. Aparecia mais
 * na barra inferior do celular, que e onde se pula de uma area para outra sem
 * passar por link nenhum.
 *
 * O catalogo fica de fora porque ele **restaura** a posicao de proposito, em
 * `Index.tsx`, para quem volta de um produto nao perder o lugar na grade — e ja
 * trata o caso de ir ao topo pelo `location.state.scrollToTop`.
 */
function ComecarNoTopo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/" || typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const { user, isPasswordRecovery } = useAuth();
  const isAdmin = location.pathname.startsWith("/admin");

  if (user && isPasswordRecovery && location.pathname !== "/recuperar-senha") {
    return <Navigate to="/recuperar-senha" replace />;
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
    );
  }


  return (
    <PublicLayout>
      <ComecarNoTopo />
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/produto/:id" element={<ProductDetails />} />
          <Route path="/pedido" element={<OrderForm />} />
          <Route path="/pedido/obrigado" element={<OrderSuccess />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecoverPassword />} />
          <Route path="/conta" element={<Account />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="/favoritos" element={<Favoritos />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PublicLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
