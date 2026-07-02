import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import type { ClientSection } from "./clientTypes";

type ClientWorkspaceShellProps = {
  section: ClientSection;
  title: string;
  onSectionChange: (section: ClientSection) => void;
  onLogout: () => void;
  userLabel: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  children: ReactNode;
};

export function ClientWorkspaceShell({
  section,
  title,
  onSectionChange,
  onLogout,
  userLabel,
  sidebarOpen,
  onSidebarToggle,
  children,
}: ClientWorkspaceShellProps) {
  const navGroups = [
    {
      label: "Minha conta",
      items: [
        { id: "resumo" as const, label: "Resumo", icon: LayoutGrid, description: "Visão geral" },
        { id: "empresa" as const, label: "Empresa", icon: Building2, description: "Dados cadastrados" },
      ],
    },
    {
      label: "Acesso e histórico",
      items: [
        { id: "pedidos" as const, label: "Pedidos", icon: ShoppingBag, description: "Acompanhamento" },
        { id: "mensagens" as const, label: "Mensagens", icon: MessageSquareText, description: "Falar com consultor" },
        { id: "seguranca" as const, label: "Segurança", icon: ShieldCheck, description: "Sessão ativa" },
      ],
    },
  ];

  const shellStyle = {
    "--client-sidebar-w": sidebarOpen ? "16rem" : "4.75rem",
  } as CSSProperties;

  const collapsed = !sidebarOpen;

  return (
    <div
      className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_30%),radial-gradient(circle_at_82%_0%,color-mix(in_oklch,var(--primary)_6%,transparent),transparent_28%),linear-gradient(180deg,#f5f8ff_0%,#f5f8ff_60%,rgba(229,236,248,0.32)_100%)] text-foreground"
      style={shellStyle}
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
          "fixed inset-y-0 left-0 z-40 flex h-screen w-[var(--client-sidebar-w)] max-lg:w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/95 shadow-[0_24px_60px_rgba(16,24,40,0.14)] backdrop-blur transition-[width,transform] duration-300 ease-out",
          sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-[5rem] items-center border-b border-border/70 px-5",
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

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
{!collapsed ? (
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <div className={cn("space-y-1.5", collapsed && "space-y-2")}> 
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
                        "group flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition-colors",
                        collapsed && "mx-auto h-12 w-12 justify-center gap-0 px-0 py-0",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                          collapsed && "h-10 w-10 rounded-[0.9rem]",
                          active ? "border-white/10 bg-white/15" : "border-border bg-background",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      {!collapsed ? (
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium leading-5">{item.label}</span>
                          <span className="block text-[11px] leading-4 opacity-75">{item.description}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/70 p-3">
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
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Cliente</p>
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
              description="Deseja encerrar a sessão do cliente atual"
              confirmLabel="Sair"
              destructive
              onConfirm={onLogout}
            />
          </div>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden transition-[padding-left] duration-300 lg:pl-[var(--client-sidebar-w)]">
        <header className="h-[5rem] shrink-0 border-b border-border/70 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur">
          <div className="flex h-full items-center justify-between gap-3 px-4 py-0 sm:px-6 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full border-border/70 bg-background text-foreground hover:bg-muted/40"
                onClick={onSidebarToggle}
                aria-label={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              <div className="min-w-0">
                <h1 className="text-[clamp(0.95rem,1.2vw,1.2rem)] font-black leading-[1.05] tracking-[-0.05em] text-foreground">
                  {title}
                </h1>
                <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground sm:text-[12px]">
                  Confira seus dados, endereço e pedidos em um espaço só seu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/" viewTransition className="hidden sm:block">
                <Button
                  variant="outline"
                  className="h-9 gap-2 rounded-full border-border/70 bg-background px-3.5 text-[13px] text-foreground hover:bg-muted/40"
                  aria-label="Voltar ao catálogo"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao catálogo
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
