import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { type CartItem, getCart, saveCart } from "@/lib/products";
import type { Product } from "@/lib/products";

type CartContextValue = {
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(99, Math.round(quantity)));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => getCart());

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      setCart,
      addToCart: (product, quantity = 1) => {
        const safeQuantity = normalizeQuantity(quantity);
        setCart((prev) => {
          const existing = prev.find((item) => item.product.id === product.id);
          if (existing) {
            return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: safeQuantity } : item));
          }
          return [...prev, { product, quantity: safeQuantity }];
        });
      },
      updateQuantity: (productId, delta) => {
        setCart((prev) =>
          prev.map((item) =>
            item.product.id === productId ? { ...item, quantity: normalizeQuantity(item.quantity + delta) } : item,
          ),
        );
      },
      setQuantity: (productId, quantity) => {
        const safeQuantity = normalizeQuantity(quantity);
        setCart((prev) =>
          prev.map((item) => (item.product.id === productId ? { ...item, quantity: safeQuantity } : item)),
        );
      },
      removeFromCart: (productId) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
      },
      clearCart: () => {
        setCart([]);
      },
    }),
    [cart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
