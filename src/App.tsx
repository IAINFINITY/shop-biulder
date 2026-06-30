import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Admin from "./pages/AdminWorkspace.tsx";
import ProductDetails from "./pages/ProductDetails.tsx";
import OrderForm from "./pages/OrderForm.tsx";
import OrderSuccess from "./pages/OrderSuccess.tsx";
import Login from "./pages/Login.tsx";
import Account from "./pages/Account.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();
const supportsViewTransitions =
  typeof document !== "undefined" && "startViewTransition" in document;

function AppRoutes() {
  const location = useLocation();

  return (
    <div
      data-native-view-transition={supportsViewTransitions ? "true" : "false"}
      className="page-shell"
    >
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/produto/:id" element={<ProductDetails />} />
        <Route path="/pedido" element={<OrderForm />} />
        <Route path="/pedido/obrigado" element={<OrderSuccess />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/conta" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
