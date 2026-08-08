import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { GuardaDeSegundoFator } from "@/components/auth/GuardaDeSegundoFator";
const Index = lazy(() => import("./pages/Index.tsx"));
/**
 * `Admin.tsx`, e nao `AdminWorkspace.tsx`.
 *
 * A rota importava o painel direto, pulando `pages/Admin.tsx` — que e quem
 * envolve tudo no `MfaGate`. O portao de segundo fator existia, estava correto e
 * tinha teste, e **nunca era montado**: nenhum arquivo importava `Admin.tsx`.
 *
 * Medido em 08/08: conta admin com fator TOTP verificado e sessao `aal1` abria o
 * painel inteiro sem o desafio. A regra devolvia `desafio_necessario` quando
 * chamada direto; ninguem a chamava.
 */
const Admin = lazy(() => import("./pages/Admin.tsx"));
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
  const { user, isAdmin: contaEhAdmin, isPasswordRecovery, deveTrocarSenha } = useAuth();
  const isAdmin = location.pathname.startsWith("/admin");

  if (user && isPasswordRecovery && location.pathname !== "/recuperar-senha") {
    return <Navigate to="/recuperar-senha" replace />;
  }

  /**
   * Senha provisoria bloqueia o site inteiro ate ser trocada.
   *
   * Fica **acima** do desvio do admin de proposito: funcionario com papel
   * administrativo tambem passa por aqui. Colocar depois deixaria justamente as
   * contas mais poderosas de fora.
   *
   * A tela ja dizia "devem trocar no primeiro acesso" — nada obrigava. Este e o
   * controle que faltava para a promessa virar verdade.
   */
  if (user && deveTrocarSenha && location.pathname !== "/recuperar-senha") {
    return <Navigate to="/recuperar-senha" replace />;
  }

  /**
   * Segundo fator: o terceiro desvio, pelo mesmo motivo dos dois acima.
   *
   * Fica **antes** do desvio do admin, como o `deveTrocarSenha` — colocar depois
   * deixaria de fora justamente as contas mais poderosas. E vale para cliente
   * tambem: quem cadastrou autenticador usa, seja qual for o papel. Ver
   * `avaliarExigenciaDeMfa`.
   *
   * `user &&` porque visitante nao tem fator a confirmar, e sem isso o
   * `useMfa` faria tres chamadas em toda visita anonima ao catalogo.
   */
  const conteudo = isAdmin ? (
    <Suspense fallback={<RouteLoader />}>
      <Routes location={location}>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Suspense>
  ) : null;

  if (isAdmin) {
    return user ? (
      <GuardaDeSegundoFator isAdmin={contaEhAdmin}>{conteudo}</GuardaDeSegundoFator>
    ) : (
      conteudo
    );
  }


  /**
   * A recuperacao de senha fica **fora** do portao.
   *
   * Os dois desvios acima mandam para `/recuperar-senha`. Se o portao cobrisse
   * essa rota, quem cai neles ficaria preso num circulo: e mandado para a
   * recuperacao e barrado antes de chegar. E quem perdeu o autenticador precisa
   * justamente desse caminho.
   */
  const foraDoPortao = location.pathname === "/recuperar-senha";

  const paginas = (
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

  return user && !foraDoPortao ? (
    <GuardaDeSegundoFator isAdmin={contaEhAdmin}>{paginas}</GuardaDeSegundoFator>
  ) : (
    paginas
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
