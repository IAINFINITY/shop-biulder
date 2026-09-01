import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Bell,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  MapPinned,
  ShoppingBag,
  Settings,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { WorkspaceBottomNav, type WorkspaceBottomNavItem } from "@/components/shared/WorkspaceBottomNav";
import type { ClientSection } from "./clientTypes";

type ClientWorkspaceShellProps = {
  section: ClientSection;
  title: string;
  onSectionChange: (section: ClientSection) => void;
  onLogout: () => void;
  userLabel: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  unreadNotificationCount?: number;
  /** Secao que ocupa toda a altura util, sem respiro. Hoje: o chat. */
  conteudoCheio?: boolean;
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
  unreadNotificationCount = 0,
  conteudoCheio = false,
  children,
}: ClientWorkspaceShellProps) {
  const navGroups = [
    {
      label: "Visão geral",
      items: [
        { id: "resumo" as const, label: "Resumo", icon: LayoutGrid },
      ],
    },
    {
      label: "Cadastro",
      items: [
        { id: "empresa" as const, label: "Empresa", icon: Building2 },
        { id: "enderecos" as const, label: "Endereços", icon: MapPinned },
      ],
    },
    {
      label: "Atividades",
      items: [
        { id: "pedidos" as const, label: "Pedidos", icon: ShoppingBag },
        { id: "notificacoes" as const, label: "Notificações", icon: Bell },
      ],
    },
    {
      label: "Atendimento",
      items: [
        { id: "mensagens" as const, label: "Mensagens", icon: MessageSquareText },
      ],
    },
    {
      label: "Sistema",
      items: [
        { id: "seguranca" as const, label: "Configurações", icon: Settings },
        { id: "meus-dados" as const, label: "Meus dados", icon: ShieldCheck },
      ],
    },
  ];

  // O rotulo do menu, e nao o `title` da pagina: "Resumo" no caminho e "Resumo
  // da conta" no cabecalho do conteudo se leem como trilha, nao como eco.
  //
  // O `as` e necessario: cada grupo tem um `id` literal proprio, e o `flatMap`
  // resulta numa uniao de arrays que o TS nao unifica sozinho.
  const rotuloDaSecao =
    navGroups
      .flatMap((grupo) => grupo.items as ReadonlyArray<{ id: ClientSection; label: string }>)
      .find((item) => item.id === section)?.label ?? title;

  // Dois atalhos, como no admin: com "Catalogo" e "Menu" nas pontas fecham
  // quatro colunas, largura ja medida sem truncar em 360px.
  //
  // Notificacoes ficam de fora da barra mas nao perdem o aviso: quando ha algo
  // nao lido, o "Menu" ganha um ponto. Melhor que uma quinta coluna espremendo
  // os rotulos.
  const PRIORIDADE_NA_BARRA: ClientSection[] = ["pedidos", "mensagens"];
  const itensDaBarra: WorkspaceBottomNavItem[] = PRIORIDADE_NA_BARRA
    .map((id) =>
      navGroups
        .flatMap((grupo) => grupo.items as ReadonlyArray<WorkspaceBottomNavItem>)
        .find((item) => item.id === id),
    )
    .filter((item): item is WorkspaceBottomNavItem => Boolean(item));

  const shellStyle = {
    "--client-sidebar-w": sidebarOpen ? "16rem" : "4.75rem",
  } as CSSProperties;

  const collapsed = !sidebarOpen;

  return (
    <div
      className={cn(
        "relative bg-muted/40 text-foreground",
        // Altura **definida** quando o conteudo ocupa tudo. `min-h-screen` e
        // minimo, e minimo nao resolve `height: 100%` no filho — era isso que
        // fazia o chat rolar dentro de uma caixa baixa em vez de preencher.
        conteudoCheio ? "h-[100dvh] overflow-hidden" : "min-h-screen",
      )}
      style={shellStyle}
    >
      <button
        type="button"
        aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
        onClick={onSidebarToggle}
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 lg:hidden",
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        tabIndex={sidebarOpen ? 0 : -1}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-[100dvh] min-h-0 w-[var(--client-sidebar-w)] max-lg:w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/95 shadow-[0_24px_60px_rgba(16,24,40,0.14)] backdrop-blur transition-[width,transform] duration-300 ease-out",
          sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-14 sm:h-[5rem] shrink-0 items-center border-b border-border/70 px-5",
            collapsed ? "justify-center px-0" : "justify-center px-5",
          )}
        >
          {/* ⚠️ A marca inteira com o menu aberto; o símbolo só com ele
              recolhido — a mesma regra do painel.

              Aqui o favicon aparecia nos **dois** estados: com 256px de largura
              disponíveis, a conta abria mostrando um quadradinho de 40px e nome
              nenhum. É o mesmo defeito que o painel já tinha corrigido, e que
              fazia as duas bancadas parecerem sites diferentes. */}
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
            <div key={group.label} className="mb-3 sm:mb-4">
{!collapsed ? (
                <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}> 
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  const naoLidas = item.id === "notificacoes" ? unreadNotificationCount : 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSectionChange(item.id)}
                      title={item.label}
                      aria-label={item.label}
                      /* ⚠️ Uma linha por item, sem a legenda e sem o círculo em
                         volta do ícone — a mesma forma do painel.

                         A área do cliente ficou com o desenho anterior: duas
                         linhas por item e o ícone dentro de um círculo com
                         borda. Com oito itens, a segunda linha e a moldura
                         viram ruído, e nenhuma legenda dizia algo que o rótulo
                         já não dissesse ("Pedidos · Acompanhamento"). */
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-[0.75rem] px-2.5 py-2 text-left text-sm transition-colors",
                        collapsed && "mx-auto h-10 w-10 justify-center gap-0 px-0 py-0",
                        active
                          ? "bg-primary font-medium text-primary-foreground"
                          : "text-foreground/75 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className={cn("h-[1.125rem] w-[1.125rem]", !active && "text-muted-foreground")} />
                        {/* Recolhida não há onde escrever o número: fica o
                            ponto, que basta para levar a pessoa a abrir o menu. */}
                        {collapsed && naoLidas > 0 ? (
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

                      {/* ⚠️ Pílula sólida, ao contrário da do painel.
                          Lá o número é profundidade de fila e sai quando alguém
                          responde; aqui é não-lido de verdade — some quando o
                          cliente abre o aviso. São coisas diferentes e o desenho
                          diz isso. */}
                      {!collapsed && naoLidas > 0 ? (
                        <span
                          aria-label={`${naoLidas} notificações não lidas`}
                          className={cn(
                            "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[0.625rem] font-semibold tabular-nums",
                            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground",
                          )}
                        >
                          {naoLidas > 9 ? "9+" : naoLidas}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* O respiro fica **neste** elemento, e nao no `<aside>`.
                
                A gaveta agora sobe para `z-50` e passa por cima da barra de
                navegacao inferior, que e `z-40`. Antes as duas eram `z-40` e o
                empate se resolvia pela ordem na arvore — a barra nasce no
                `PublicLayout`, vem depois, e cobria os 56px de baixo da gaveta,
                que e justamente onde fica o botao de sair.
                
                Nao adianta reservar o espaco no `<aside>`: ele ja carregava um
                `max-lg:pb-[env(safe-area-inset-bottom)]`, e duas classes de
                `padding-bottom` no mesmo elemento nao se somam — vence a que
                sair depois na folha de estilo, nao a que vier depois no
                `className`. O respiro aqui inclui a area segura, entao aquela
                classe saiu do `<aside>`. */}
              <div className="shrink-0 border-t border-border/70 p-2.5 sm:p-3 pb-[calc(0.625rem+env(safe-area-inset-bottom,0rem))] sm:pb-[calc(0.75rem+env(safe-area-inset-bottom,0rem))]">
          <div
            className={cn(
              "flex items-center gap-3 rounded-[1.25rem] bg-background/95 border border-border/70 px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
              collapsed && "justify-between px-2.5 py-2",
            )}
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {userLabel.slice(0, 1).toUpperCase()}
              {unreadNotificationCount > 0 ? (
                <span
                  className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground shadow-sm"
                  aria-label={`${unreadNotificationCount} notificações não lidas`}
                >
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{userLabel}</p>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
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
              description="Deseja encerrar a sessão do cliente atual"
              confirmLabel="Sair"
              destructive
              onConfirm={onLogout}
            />
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding-left] duration-300 lg:pl-[var(--client-sidebar-w)]",
          conteudoCheio ? "h-full min-h-0" : "min-h-screen",
          // Espaco da barra inferior. Aqui, e nao no `<main>`, para valer tambem
          // na secao de altura cheia (o chat), onde o `<main>` e `p-0`.
          "max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0rem))]",
        )}
      >
        <header className="h-14 sm:h-[5rem] shrink-0 border-b border-border/70 bg-card/95 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur">
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
                {/* Ponto de aviso no proprio hamburguer.

                    Notificacoes nao cabem na barra inferior sem apertar os
                    rotulos, mas o sinal nao pode se perder. Como o hamburguer e
                    a porta do menu completo — que e onde a secao vive —, e nele
                    que o aviso faz sentido. */}
                <span className="relative inline-flex">
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
                  {unreadNotificationCount > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card"
                    />
                  ) : null}
                </span>
              </Button>

              {/* Localizador, e nao titulo de pagina.

                  Antes aqui vinha um `h1` com o titulo da secao e, logo abaixo
                  no conteudo, o `ClientSectionHeader` repetia o mesmo titulo —
                  duas vezes a mesma frase em 200px de distancia. Pior: a
                  descricao desta barra era **fixa** ("Confira seus dados,
                  endereco e pedidos"), igual em todas as sete secoes, entao nao
                  informava nada.

                  Agora esta barra so diz **onde voce esta** (identidade +
                  rotulo curto do menu, em texto miudo) e o titulo de verdade
                  fica no conteudo. E o padrao de bancada: barra fixa como
                  caminho, conteudo com o cabecalho. */}
              <div className="min-w-0 flex flex-col leading-none">
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Clinic+ · Minha conta
                </span>
                <span className="mt-1 truncate text-sm font-medium text-foreground">{rotuloDaSecao}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* No celular ele vive na barra inferior, junto do "Menu" — mesma
                  posicao e mesmo papel que no admin. */}
              <Link to="/" viewTransition className="hidden lg:inline-flex">
                <Button
                  variant="outline"
                  className="h-10 w-auto sm:w-auto gap-1 sm:gap-2 rounded-full border-border/70 bg-background text-[0.8125rem] text-foreground hover:bg-muted/40 px-3 sm:px-3.5"
                  aria-label="Voltar ao catálogo"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-4 sm:w-4" />
                  <span className="ml-1 text-xs sm:hidden">Catálogo</span>
                  <span className="hidden sm:inline">Voltar ao catálogo</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Teto de largura, como no catalogo.
          
            O `main` nao tinha limite: numa tela de 2560px o conteudo chegava a
            2224px de largura, contra os 1616px em que o catalogo para. Linha de
            texto longa demais custa leitura, e a area de cliente e feita de
            leitura — dados do cadastro, historico de pedido, avisos.
            
            1680px e o mesmo `PAGE_MAX_WIDTH` da vitrine. `mx-auto` centraliza o
            que sobrar, em vez de deixar tudo encostado na barra lateral. */}
          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              // Sem respiro na secao cheia: o chat desenha a propria borda e o
              // padding aqui so encolheria a area util.
              conteudoCheio ? "overflow-hidden p-0" : "px-3 py-3 pb-safe sm:px-6 sm:py-6 lg:px-8 lg:py-8",
            )}
          >
            {children}
          </main>
      </div>
      <WorkspaceBottomNav
        itens={itensDaBarra}
        section={section}
        onSectionChange={(id) => onSectionChange(id as ClientSection)}
        rotuloDaNavegacao="Navegação da conta"
      />

    </div>
  );
}
