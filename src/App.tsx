import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { PublicLayout } from "@/components/layout/PublicLayout";
const Index = lazy(() => import("./pages/Index.tsx"));
const Admin = lazy(() => import("./pages/AdminWorkspace.tsx"));
const ProductDetails = lazy(() => import("./pages/ProductDetails.tsx"));
const OrderForm = lazy(() => import("./pages/OrderForm.tsx"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
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

function AppRoutes() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

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
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/produto/:id" element={<ProductDetails />} />
          <Route path="/pedido" element={<OrderForm />} />
          <Route path="/pedido/obrigado" element={<OrderSuccess />} />
          <Route path="/login" element={<Login />} />
          <Route path="/conta" element={<Account />} />
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
