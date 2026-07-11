import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, BadgeDollarSign, Bell, ChevronLeft, ChevronRight, Image, LayoutDashboard, LogOut, MessageSquareText, Package, Settings, Shield, ShoppingBag, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { useProxisHealth } from "@/hooks/useProxisHealth";
import type { AdminSection } from "./adminTypes";

type AdminWorkspaceShellProps = {
  section: AdminSection;
  title: string;
  onSectionChange: (section: AdminSection) => void;
  onLogout: () => void;
  userLabel: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  isSuperadmin?: boolean;
  children: ReactNode;
};

function MenuProxisStatus({ collapsed }: { collapsed: boolean }) {
  const { connected, checking, checkNow } = useProxisHealth();

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={checkNow}
        title={connected ? "Proxis conectado" : checking ? "Verificando Proxis..." : "Proxis desconectado"}
        aria-label={connected ? "Proxis conectado" : "Proxis desconectado"}
        className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted/40"
      >
        <span className="relative flex h-3 w-3">
          <span className={cn("absolute inset-0 rounded-full", connected ? "bg-emerald-500" : "bg-red-400", checking && "animate-pulse")} />
          {connected ? (
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <div className="shrink-0 border-t border-border/70 px-3 pb-2 pt-2.5">
      <button
        type="button"
        onClick={checkNow}
        className="flex w-full items-center gap-2.5 rounded-[1rem] px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={cn("absolute inset-0 rounded-full", connected ? "bg-emerald-500" : "bg-red-400", checking && "animate-pulse")} />
          {connected ? (
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
          ) : null}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">
          {connected ? "Proxis conectado" : checking ? "Verificando..." : "Proxis offline"}
        </span>
        <span className="ml-auto">
          {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </span>
      </button>
    </div>
  );
}

export function AdminWorkspaceShell({
  section,
  title,
  onSectionChange,
  onLogout,
  userLabel,
  sidebarOpen,
  onSidebarToggle,
  isSuperadmin = false,
  children,
}: AdminWorkspaceShellProps) {
  const navGroups = [
    {
      label: "Visão geral",
      items: [
        { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard, description: "Resumo geral" },
        { id: "banners" as const, label: "Banners", icon: Image, description: "Hero do catálogo" },
        { id: "notificacoes" as const, label: "Notificações", icon: Bell, description: "Campanhas e avisos" },
        { id: "produtos" as const, label: "Produtos", icon: Package, description: "Catálogo e edição" },
        { id: "precos" as const, label: "Preços", icon: BadgeDollarSign, description: "Tabelas e ajustes" },
        { id: "pedidos" as const, label: "Pedidos", icon: ShoppingBag, description: "Operação diária" },
      ],
    },
    {
      label: "Consultas",
      items: [
        { id: "clientes" as const, label: "Clientes", icon: Users, description: "Base cadastrada" },
        { id: "mensagens" as const, label: "Mensagens", icon: MessageSquareText, description: "Inbox interno" },
      ],
    },
    ...(isSuperadmin ? [{
      label: "Administração",
      items: [
        { id: "usuarios" as const, label: "Usuários", icon: Shield, description: "Contas e permissões" },
      ],
    }] : []),
    {
      label: "Sistema",
      items: [
        { id: "configuracoes" as const, label: "Configurações", icon: Settings, description: "Senha e perfil" },
      ],
    },
  ];

  const collapsed = !sidebarOpen;

  return (
    <div
      className="relative min-h-screen bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_30%),radial-gradient(circle_at_82%_0%,color-mix(in_oklch,var(--primary)_6%,transparent),transparent_28%),linear-gradient(180deg,#f5f8ff_0%,#f5f8ff_60%,rgba(229,236,248,0.32)_100%)] text-foreground"
      style={{ "--admin-sidebar-w": sidebarOpen ? "16rem" : "4.75rem" } as CSSProperties}
    >
      <button
        type="button"
        aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
        onClick={onSidebarToggle}
        className={cn(
          "fixed inset-0 z-30 bg-black/20 transition-opacity duration-300 lg:hidden",
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        tabIndex={sidebarOpen ? 0 : -1}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-[100dvh] min-h-0 w-[var(--admin-sidebar-w)] max-lg:w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/95 shadow-[0_24px_60px_rgba(16,24,40,0.14)] backdrop-blur transition-[width,transform] duration-300 ease-out max-lg:pb-[env(safe-area-inset-bottom)]",
          sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-14 sm:h-[5rem] shrink-0 items-center border-b border-border/70 px-5",
            collapsed ? "justify-center px-0" : "justify-center px-5",
          )}
        >
          <Link
            to="/"
            viewTransition
            className={cn("inline-flex items-center gap-3", collapsed ? "justify-center" : "justify-center")}
          >
            <img
              src="/faviconV2.png"
              alt="Clinic+"
              className={cn(
                "shrink-0 rounded-[0.85rem] border border-primary/15 bg-background p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300",
                "h-10 w-10",
              )}
            />
          </Link>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 sm:py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3 sm:mb-4">
              {!collapsed ? (
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <div className={cn("space-y-1 sm:space-y-1.5", collapsed && "space-y-2")}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSectionChange(item.id)}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        "group flex w-full items-center gap-2.5 sm:gap-3 rounded-[1rem] px-2.5 sm:px-3 py-2.5 sm:py-3 text-left transition-colors",
                        collapsed && "mx-auto h-12 w-12 justify-center gap-0 px-0 py-0",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                          collapsed && "h-10 w-10 rounded-[0.9rem]",
                          active ? "border-white/10 bg-white/15" : "border-border bg-background",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      {!collapsed ? (
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] sm:text-[14px] font-medium leading-5">{item.label}</span>
                          <span className="block text-[10px] sm:text-[11px] leading-4 opacity-75">{item.description}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <MenuProxisStatus collapsed={collapsed} />

        <div className="shrink-0 border-t border-border/70 p-2.5 sm:p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border/70 bg-background/95 px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
              collapsed && "justify-between px-2.5 py-2",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {userLabel.slice(0, 1).toUpperCase()}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{userLabel}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Admin</p>
              </div>
            ) : null}
            <ConfirmActionDialog
              trigger={
                <Button
                  type="button"
                  variant={collapsed ? "outline" : "ghost"}
                  size={collapsed ? "icon" : "sm"}
                  className={cn(
                    "shrink-0 rounded-full text-primary hover:bg-primary/5 hover:text-primary",
                    collapsed ? "h-9 w-9 border-border/70 bg-background" : "h-9 border-border/70 px-3",
                  )}
                  aria-label="Sair da conta"
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed ? <span className="ml-2">Sair</span> : null}
                </Button>
              }
              title="Sair da conta"
              description="Deseja encerrar a sessão administrativa atual"
              confirmLabel="Sair"
              destructive
              onConfirm={onLogout}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col transition-[padding-left] duration-300 lg:pl-[var(--admin-sidebar-w)]">
        <header className="h-14 sm:h-[5rem] shrink-0 border-b border-border/70 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur">
          <div className="flex h-full items-center justify-between gap-3 px-4 py-0 sm:px-6 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 lg:h-9 lg:w-9 shrink-0 rounded-full border-border/70 bg-background text-foreground hover:bg-muted/40"
                onClick={onSidebarToggle}
                aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              <div className="min-w-0 hidden sm:block">
                <h1 className="text-[clamp(0.95rem,1.2vw,1.2rem)] font-black leading-[1.05] tracking-[-0.05em] text-foreground">
                  {title}
                </h1>
                <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground sm:text-[12px]">
                  Gerencie produtos, pedidos e clientes em uma interface mais leve.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/" viewTransition>
                <Button
                  variant="outline"
                  className="h-10 w-auto sm:w-auto gap-1 sm:gap-2 rounded-full border-border/70 bg-background text-[13px] text-foreground hover:bg-muted/40 px-3 sm:px-3.5"
                  aria-label="Voltar ao catálogo"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-1 text-xs sm:hidden">Catálogo</span>
                  <span className="hidden sm:inline">Voltar ao catálogo</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-safe">{children}</main>
      </div>
    </div>
  );
}
