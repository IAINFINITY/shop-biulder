import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { WorkspaceBottomNav, type WorkspaceBottomNavItem } from "@/components/shared/WorkspaceBottomNav";
import { Menu, ArrowLeft, BadgeDollarSign, Bell, Clock, ChevronLeft, ChevronRight, Image, LayoutDashboard, LogOut, MessageSquareText, Package, Settings, Shield, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import type { AdminSection } from "./adminTypes";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { SinoDeAvisos } from "@/components/admin/SinoDeAvisos";
import { canAccessAdminSection, type AdminPermissions } from "@/lib/adminUsers";
import { useConversasEsperando } from "@/hooks/useSupportChat";

type AdminWorkspaceShellProps = {
  section: AdminSection;
  title: string;
  /** `foco` opcional: leva a tela ate um pedaco dela — ver `setSection`. */
  onSectionChange: (section: AdminSection, foco?: string) => void;
  onLogout: () => void;
  userLabel: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  isSuperadmin?: boolean;
  permissions?: AdminPermissions | null;
  /** Secao que ocupa toda a altura util, sem respiro. Hoje: o chat. */
  conteudoCheio?: boolean;
  children: ReactNode;
};

export function AdminWorkspaceShell({
  section,
  title,
  onSectionChange,
  onLogout,
  userLabel,
  sidebarOpen,
  onSidebarToggle,
  isSuperadmin = false,
  permissions = null,
  conteudoCheio = false,
  children,
}: AdminWorkspaceShellProps) {
  function hasPermission(id: AdminSection): boolean {
    return canAccessAdminSection(id, { isSuperadmin, permissions });
  }

  // O aviso de Mensagens acompanha o painel inteiro, e nao so a tela de
  // mensagens: era esse o buraco — o cliente escrevia e ninguem ficava sabendo
  // ate alguem entrar na secao por conta propria.
  const { data: esperando = 0 } = useConversasEsperando(hasPermission("mensagens"));

  /**
   * A navegação agrupada pelo que a pessoa está fazendo.
   *
   * ## O que estava confuso
   *
   * "Visão geral" tinha **sete** itens e nada em comum entre eles: Dashboard é
   * leitura, Produtos/Imagens/Preços é trabalho de catálogo, Pedidos é a
   * operação do dia, Banners e Notificações são divulgação. O nome do grupo
   * prometia um resumo e entregava o menu inteiro.
   *
   * "Consultas" juntava Clientes com Mensagens, que não é consulta — é
   * atendimento. E as três listas de gente do painel (Clientes, Funcionários,
   * Usuários) estavam espalhadas por dois grupos, embora sejam a mesma ideia:
   * quem tem conta aqui.
   *
   * Agora são cinco grupos de até cinco itens, cada um com um assunto só.
   */
  const navGroups = [
    {
      label: "Acompanhar",
      items: [{ id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Catálogo",
      items: [
        ...(hasPermission("produtos") ? [{ id: "produtos" as const, label: "Produtos", icon: Package }] : []),
        ...(hasPermission("precos") ? [{ id: "precos" as const, label: "Preços", icon: BadgeDollarSign }] : []),
        ...(hasPermission("imagens") ? [{ id: "imagens" as const, label: "Imagens", icon: Image }] : []),
        ...(hasPermission("banners") ? [{ id: "banners" as const, label: "Banners", icon: Image }] : []),
        ...(hasPermission("notificacoes") ? [{ id: "notificacoes" as const, label: "Notificações", icon: Bell }] : []),
      ],
    },
    {
      label: "Operação",
      items: [
        ...(hasPermission("pedidos") ? [{ id: "pedidos" as const, label: "Pedidos", icon: ShoppingBag }] : []),
        ...(hasPermission("mensagens")
          ? [{ id: "mensagens" as const, label: "Mensagens", icon: MessageSquareText, aviso: esperando }]
          : []),
      ],
    },
    {
      label: "Pessoas",
      items: [
        ...(hasPermission("clientes") ? [{ id: "clientes" as const, label: "Clientes", icon: Users }] : []),
        ...(hasPermission("funcionarios") ? [{ id: "funcionarios" as const, label: "Funcionários", icon: Users }] : []),
        ...(hasPermission("usuarios") ? [{ id: "usuarios" as const, label: "Administradores", icon: Shield }] : []),
      ],
    },
    {
      label: "Sistema",
      items: [
        ...(hasPermission("configuracoes") ? [{ id: "configuracoes" as const, label: "Configurações", icon: Settings }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  // O rotulo curto do menu, como no cliente: caminho na barra, titulo no
  // conteudo. O `as` e necessario porque cada item tem `id` literal proprio e o
  // `flatMap` gera uma uniao que o TS nao unifica sozinho.
  const rotuloDaSecao =
    navGroups
      .flatMap((grupo) => grupo.items as ReadonlyArray<{ id: string; label: string }>)
      .find((item) => item.id === section)?.label ?? title;

  /**
   * Os atalhos que entram na barra inferior do celular.
   *
   * Tres, no maximo — com o "Menu" ao lado dao quatro colunas, que e o limite
   * antes de os rotulos comecarem a truncar em tela de 360px.
   *
   * A ordem e de uso diario, nao a do menu: quem abre o admin pelo telefone
   * quase sempre esta atras de um pedido ou de uma mensagem. O que nao couber
   * continua na gaveta, a um toque do "Menu".
   */
  const PRIORIDADE_NA_BARRA = ["pedidos", "mensagens"];
  const itensDaBarra: WorkspaceBottomNavItem[] = PRIORIDADE_NA_BARRA
    .map((id) =>
      navGroups
        .flatMap((grupo) => grupo.items as ReadonlyArray<WorkspaceBottomNavItem>)
        .find((item) => item.id === id),
    )
    // `filter(Boolean)` porque a permissao pode ter tirado a secao do menu:
    // mostrar atalho para o que a pessoa nao pode abrir seria pior que nao ter.
    .filter((item): item is WorkspaceBottomNavItem => Boolean(item));

  const collapsed = !sidebarOpen;

  return (
    <div
      className={cn(
        "relative bg-muted/40 text-foreground",
        // Altura definida, e nao minima: `min-h-screen` nao resolve `height:100%`
        // no filho, e sem isso o chat rolava dentro de uma caixa baixa.
        conteudoCheio ? "h-[100dvh] overflow-hidden" : "min-h-screen",
      )}
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
          {/* A marca inteira com o menu aberto, o símbolo com ele recolhido —
              é a forma dos dois CRMs de referência (`BrandLogo` com variante
              `surface`/`compact`).

              Antes o quadradinho do favicon aparecia nos dois estados: com
              256px de largura disponíveis, o painel abria mostrando um ícone de
              40px e nenhum nome. A logo usada é a mesma de `ClinicPlusLogo`, do
              cabeçalho do catálogo, para o admin não parecer outro site. */}
          <Link
            to="/"
            viewTransition
            aria-label="Voltar ao catálogo Clinic+"
            className="inline-flex items-center justify-center"
          >
            {collapsed ? (
              <img
                src="/faviconV2.png"
                alt="Clinic+"
                className="h-10 w-10 shrink-0 rounded-[0.85rem] border border-primary/15 bg-background p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              />
            ) : (
              <ClinicPlusLogo className="h-9 w-auto max-w-[10.5rem] sm:h-10" />
            )}
          </Link>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 sm:py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed ? (
                <p className="px-2.5 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                  {group.label}
                </p>
              ) : null}
              <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}>
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
                      /* Uma linha por item, sem a legenda e sem o círculo em
                         volta do ícone. Com doze itens, a segunda linha e a
                         moldura viravam ruído: o menu ocupava a tela inteira e
                         nenhuma legenda dizia algo que o rótulo já não dissesse
                         ("Pedidos · Operação diária"). É a forma dos dois CRMs
                         que servem de referência. */
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-[0.75rem] px-2.5 py-2 text-left text-sm transition-colors",
                        collapsed && "mx-auto h-10 w-10 justify-center gap-0 px-0 py-0",
                        active
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground/75 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className={cn("h-[1.125rem] w-[1.125rem]", !active && "text-muted-foreground")} />
                        {/* Recolhida nao ha onde escrever o numero: fica o ponto,
                            que e o bastante para levar a pessoa a abrir o menu. */}
                        {collapsed && item.aviso ? (
                          <span
                            aria-hidden
                            className={cn(
                              "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2",
                              active ? "bg-primary-foreground ring-primary" : "bg-primary ring-card",
                            )}
                          />
                        ) : null}
                      </span>
                      {!collapsed ? <span className="min-w-0 flex-1 truncate leading-5">{item.label}</span> : null}
                      {!collapsed && item.aviso ? (
                        <span
                          /* ⚠️ **Relogio, e nao bolinha de nao-lida.**

                             Isto e profundidade de fila, nao notificacao: o
                             numero cai quando alguem **responde** ao cliente,
                             nao quando alguem abre a conversa. Com a pilha
                             solida de sempre, ele se lia como "nao lido, clique
                             para limpar" — e clicar nao limpava nada, o que
                             parece defeito.

                             O sino da topbar e que e nao-lido de verdade, com
                             leitura por pessoa. Dois numeros iguais para coisas
                             diferentes era o que confundia. */
                          title={`${item.aviso} ${item.aviso === 1 ? "cliente espera" : "clientes esperam"} resposta. Sai da conta quando você responder.`}
                          aria-label={`${item.aviso} esperando resposta`}
                          className={cn(
                            "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                            active
                              ? "border-primary-foreground/40 text-primary-foreground"
                              : "border-primary/40 bg-primary/10 text-primary",
                          )}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {item.aviso}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>


        <div className="shrink-0 border-t border-border/70 p-2.5 sm:p-3 pb-[calc(0.625rem+env(safe-area-inset-bottom,0rem))] sm:pb-[calc(0.75rem+env(safe-area-inset-bottom,0rem))]">
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
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
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
                    collapsed ? "h-10 sm:h-9 w-10 sm:w-9 border-border/70 bg-background" : "h-9 border-border/70 px-3",
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

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding-left] duration-300 lg:pl-[var(--admin-sidebar-w)]",
          conteudoCheio ? "h-full min-h-0" : "min-h-screen",
          // Espaco para a barra inferior. Fica aqui, e nao no `<main>`, para
          // valer tambem na secao de altura cheia (o chat), onde o `<main>` e
          // `p-0` e o conteudo encostaria na barra.
          //
          // Sem condicao: a barra existe sempre, porque mesmo sem nenhum atalho
          // liberado por permissao ela ainda leva "Catalogo" e "Menu".
          "max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0rem))]",
        )}
      >
        <header className="h-14 sm:h-[5rem] shrink-0 border-b border-border/70 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur">
          <div className="flex h-full items-center justify-between gap-3 px-4 py-0 sm:px-6 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 lg:h-9 lg:w-9 shrink-0 rounded-full border-border/70 bg-background text-foreground hover:bg-muted/40"
                onClick={onSidebarToggle}
                aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
              >
                {/* Hamburguer no celular, seta no desktop.

                    Sao duas funcoes diferentes no mesmo botao. No celular ele
                    **abre o menu** — e hamburguer e o simbolo que todo mundo
                    reconhece para isso. No desktop ele **recolhe a barra
                    lateral**, e ali a seta ganha sentido: ela aponta para onde a
                    barra vai. Seta no celular nao apontava para nada. */}
                  <Menu className="h-4 w-4 lg:hidden" />
                  {sidebarOpen ? (
                    <ChevronLeft className="hidden h-4 w-4 lg:block" />
                  ) : (
                    <ChevronRight className="hidden h-4 w-4 lg:block" />
                  )}
              </Button>

              {/* Localizador, e nao titulo de pagina — mesma correcao feita na
                  area de cliente. Antes um `h1` repetia aqui o titulo que a
                  secao ja mostra logo abaixo, e a descricao era **fixa**
                  ("Gerencie produtos, pedidos e clientes"), igual nas 13 secoes.
                  Duas frases, nenhuma dizendo onde a pessoa esta. */}
              <div className="min-w-0 flex flex-col leading-none">
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Clinic+ · Administração
                </span>
                <span className="mt-1 truncate text-sm font-medium text-foreground">{rotuloDaSecao}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* No celular este link vive na barra inferior, junto do "Menu":
                  topo e o canto mais dificil de alcancar com o polegar, e a
                  barra e onde a area de cliente ja poe o caminho de volta. */}
              {/* O sino ao lado do "Voltar ao catálogo", como pedido — e visível
                  no celular também, onde o botão de catálogo desce para a barra
                  de baixo e este canto fica livre. */}
              <SinoDeAvisos onIrParaSecao={onSectionChange} podeVerSecao={hasPermission} />

              <Link to="/" viewTransition className="hidden lg:inline-flex">
                <Button
                  variant="outline"
                  className="h-10 w-auto sm:w-auto gap-1 sm:gap-2 rounded-full border-border/70 bg-background text-[0.8125rem] text-foreground hover:bg-muted/40 px-3 sm:px-3.5"
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

        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            conteudoCheio ? "overflow-hidden p-0" : "px-3 py-3 pb-safe sm:px-6 sm:py-6 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>
      <WorkspaceBottomNav
        itens={itensDaBarra}
        section={section}
        onSectionChange={(id) => onSectionChange(id as typeof section)}
        rotuloDaNavegacao="Navegação do administrativo"
      />

    </div>
  );
}
