import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  ClipboardList,
  HelpCircle,
  Info,
  KeyRound,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  UserRound,
} from "lucide-react";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { useAuth } from "@/hooks/useAuth";
import { useHashScroll } from "@/hooks/useHashScroll";
import { SectionAnchorNav } from "@/components/shared/SectionAnchorNav";
import { CatalogSectionHeader } from "@/components/catalogo/CatalogSectionHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/pageLayout";

const COMPANY = {
  phone: "(49) 3433-5400",
  whatsapp: "(49) 2020-9980",
  whatsappLink: "https://wa.me/554920209980",
  email: "atendimento@amaiss.com.br",
  hours: "Seg a Sex, 7:30 às 17:00",
  address: "Rua Lauro Muller, 60, Matinho · Xanxerê/SC",
};

/**
 * Cartao de ajuda que leva a algum lugar.
 *
 * Antes estes blocos eram <div> de texto: explicavam a acao ("entre com seu
 * login", "procure por nome ou codigo") sem oferecer o caminho para executa-la.
 * Quem chegava na Central de Ajuda com uma duvida saia dela no mesmo lugar.
 */
type HelpAction = {
  id: string;
  title: string;
  description: string;
  cta: string;
  to: string;
  icon: LucideIcon;
  keywords: string[];
};

const ACCOUNT_ACTIONS: HelpAction[] = [
  {
    id: "acesso",
    title: "Acesso",
    description: "Entre com seu login para ver pedidos, ajustar dados e seguir com o atendimento.",
    cta: "Ir para o login",
    to: "/login",
    icon: LogIn,
    keywords: ["login", "acesso", "entrar", "conta"],
  },
  {
    id: "meus-pedidos",
    title: "Pedidos",
    description: "Acompanhe o histórico pelo menu da conta e confira os detalhes enviados.",
    cta: "Ver meus pedidos",
    to: "/conta?section=pedidos",
    icon: ClipboardList,
    keywords: ["pedido", "historico", "acompanhar", "status"],
  },
  {
    id: "enderecos",
    title: "Endereços",
    description: "Mantenha o endereço completo e atualizado para agilizar o processamento.",
    cta: "Gerenciar endereços",
    to: "/conta?section=enderecos",
    icon: MapPin,
    keywords: ["endereco", "cep", "entrega", "cadastro"],
  },
  {
    id: "senha",
    title: "Senha e segurança",
    description: "Ajuste sua senha e revise os dados de acesso da conta.",
    cta: "Abrir segurança",
    to: "/conta?section=seguranca",
    icon: KeyRound,
    keywords: ["senha", "seguranca", "acesso", "recuperar"],
  },
  {
    id: "dados-empresa",
    title: "Dados da empresa",
    description: "Confira CNPJ, razão social e contato usados nos seus pedidos.",
    cta: "Abrir meus dados",
    to: "/conta?section=empresa",
    icon: UserRound,
    keywords: ["empresa", "cnpj", "dados", "cadastro"],
  },
  {
    id: "mensagens",
    title: "Mensagens",
    description: "Fale com a equipe pelo chat interno e acompanhe as respostas.",
    cta: "Abrir mensagens",
    to: "/conta?section=mensagens",
    icon: MessageSquare,
    keywords: ["mensagem", "chat", "suporte", "atendimento"],
  },
];

const CATALOG_ACTIONS: HelpAction[] = [
  {
    id: "busca",
    title: "Busca",
    description: "Procure por nome, descrição ou código do produto.",
    cta: "Buscar no catálogo",
    to: "/",
    icon: Search,
    keywords: ["busca", "procurar", "codigo", "nome"],
  },
  {
    id: "filtros",
    title: "Filtros",
    description: "Filtre por marca, categoria e subcategoria para chegar mais rápido no item certo.",
    cta: "Abrir catálogo",
    to: "/",
    icon: SlidersHorizontal,
    keywords: ["filtro", "marca", "categoria", "subcategoria", "ordenar"],
  },
  {
    id: "detalhes",
    title: "Detalhes do produto",
    description: "Abra o produto para ver imagens ampliadas, descrição e informações de apoio.",
    cta: "Ver produtos",
    to: "/",
    icon: Info,
    keywords: ["produto", "detalhe", "imagem", "descricao"],
  },
  {
    id: "favoritos",
    title: "Favoritos",
    description: "Salve os itens que você repete no pedido e volte neles quando precisar.",
    cta: "Ver favoritos",
    to: "/?view=favoritos",
    icon: ShoppingBag,
    keywords: ["favorito", "salvar", "lista", "carrinho"],
  },
];

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

const FAQS: FaqItem[] = [
  {
    id: "como-fazer-pedido",
    question: "Como faço um pedido?",
    answer:
      "Escolha os produtos no catálogo, adicione ao carrinho e siga para Finalizar pedido. Antes de enviar, confira empresa, CNPJ e endereço.",
    keywords: ["pedido", "comprar", "carrinho", "finalizar"],
  },
  {
    id: "acompanhar-pedido",
    question: "Onde vejo meus pedidos?",
    answer:
      "Entre em Minha conta e abra a seção de pedidos. Lá você encontra o histórico enviado pelo seu cadastro.",
    keywords: ["pedido", "historico", "acompanhar", "meus pedidos"],
  },
  {
    id: "senha-acesso",
    question: "Esqueci a senha. O que faço?",
    answer:
      "Abra a seção de segurança dentro da sua conta para ajustar a senha. Se não conseguir entrar, fale com o atendimento que a equipe libera o acesso.",
    keywords: ["senha", "acesso", "login", "recuperar"],
  },
  {
    id: "catalogo-produtos",
    question: "Não achei um produto. Como procurar melhor?",
    answer:
      "Use a busca do catálogo por nome ou código, e combine com os filtros de marca, categoria e subcategoria. A página do produto traz imagens e informações detalhadas.",
    keywords: ["produto", "buscar", "catalogo", "filtro", "imagem", "marca"],
  },
  {
    id: "entrega-dados",
    question: "Por que preciso preencher o endereço completo?",
    answer:
      "O endereço valida a solicitação e deixa o pedido pronto para conferência. Quanto mais completo, mais rápido o atendimento segue com a análise.",
    keywords: ["endereco", "cep", "entrega", "cadastro"],
  },
  {
    id: "preco-tabela",
    question: "Por que o preço que vejo é diferente do de outro cliente?",
    answer:
      "Cada cliente enxerga a tabela comercial vinculada ao seu cadastro. Se o valor parecer incorreto, fale com seu consultor para revisar a tabela aplicada.",
    keywords: ["preco", "tabela", "valor", "desconto"],
  },
  {
    id: "atendimento-contato",
    question: "Como falar com atendimento?",
    answer:
      "Você pode falar com a equipe por WhatsApp, telefone ou e-mail dentro do horário comercial, ou usar o chat dentro da sua conta.",
    keywords: ["atendimento", "whatsapp", "telefone", "email", "contato"],
  },
];

/**
 * Cada passo aponta para o lugar onde ele acontece. O ultimo nao tem link
 * porque nao depende do cliente — deixar um "Ver" ali prometeria uma tela que
 * nao existe.
 */
const STEPS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  to?: string;
  cta?: string;
}> = [
  {
    title: "Escolha os itens",
    description: "Pesquise, filtre por marca ou categoria e abra o produto desejado.",
    icon: Search,
    to: "/",
    cta: "Ir ao catálogo",
  },
  {
    title: "Monte o carrinho",
    description: "Ajuste quantidades, adicione observações por item e revise o total.",
    icon: ShoppingBag,
    to: "/",
    cta: "Ver produtos",
  },
  {
    title: "Confirme os dados",
    description: "Confira empresa, CNPJ e endereço de entrega antes de enviar.",
    icon: ClipboardList,
    to: "/conta?section=empresa",
    cta: "Revisar meus dados",
  },
  {
    title: "Aguarde o retorno",
    description: "O pedido segue para processamento e o consultor entra em contato.",
    icon: Clock3,
  },
];

const ORDER_NOTES = [
  "O pedido é montado no catálogo e conferido no checkout.",
  "Depois de enviado, ele segue para o atendimento processar.",
  "Pagamento e condições comerciais são alinhados com o consultor.",
];

const SECTIONS = [
  { id: "conta", label: "Conta", icon: UserRound },
  { id: "catalogo", label: "Catálogo", icon: Package },
  { id: "como-funciona", label: "Como funciona", icon: Truck },
  { id: "pedidos", label: "Perguntas frequentes", icon: HelpCircle },
  { id: "atendimento", label: "Atendimento", icon: MessageSquare },
] as const;

/** Compara ignorando acento e caixa, para "codigo" encontrar "código". */


function SectionBlock({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--page-header-shell-height,88px)+4.5rem)]">
      {/* Mesmo cabecalho das secoes do catalogo: barra vertical, titulo, linha
          de apoio e o filete embaixo. Aqui era um `h2` com paragrafo solto, sem
          barra e sem separador — duas paginas publicas anunciando secao de jeitos
          diferentes. */}
      <CatalogSectionHeader title={title} subtitle={description} actions={action} />
      <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card p-4 shadow-sm sm:rounded-[1.75rem] sm:p-6 lg:p-8">
        {children}
      </div>
    </section>
  );
}

function HelpActionCard({ action }: { action: HelpAction }) {
  const Icon = action.icon;

  return (
    <Link
      to={action.to}
      viewTransition
      className="group flex h-full min-h-[132px] flex-col justify-between rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {action.title}
          </p>
          <p className="text-[0.8125rem] leading-5 text-muted-foreground">
            {action.description}
          </p>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
        {action.cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function Help() {
  // O banner do topo respeita `visible_to`, igual as outras areas: campanha
  // restrita a um tipo de cliente nao pode vazar para os demais.
  const { customerProfile } = useAuth();
  const customerType = customerProfile?.customer_type ?? null;
  useHashScroll();

  // Sem busca, as tres listas sao as constantes inteiras. Ficam como referencias
  // diretas em vez de `useMemo` de filtro: nao ha mais o que filtrar.
  const accountActions = ACCOUNT_ACTIONS;
  const catalogActions = CATALOG_ACTIONS;
  const faqs = FAQS;

  // O accordion e controlado o tempo todo — alternar entre controlado e nao
  // controlado quebraria o clique.
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([]);

  return (
    <div className="relative min-h-screen bg-muted/40 pb-32 sm:pb-[10rem]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-200px] h-96 w-96 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute right-[-100px] top-40 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Fora do `main` de proposito: o banner vai de borda a borda, e o cartao
          logo abaixo tem `overflow-hidden` — dentro dele a sangria seria cortada
          na largura do cartao. */}
      <StoreHeroBanner
        slot="ajuda"
        carrossel={false}
        customerType={customerType}
        rotulo="Destaque da Central de ajuda"
      />

      {/* `pt-1 sm:pt-3` e o mesmo respiro do catalogo (`Index.tsx`), para a
          navegacao entre secoes comecar na mesma altura nas duas paginas. Aqui
          era `py-4 sm:py-6 lg:py-8`, e a barra descia ate 20px a mais. */}
      {/* Fora do `main` de proposito, e nao so por semantica.
          
          O `main` usa `space-y-8`, que poe margem entre irmaos. Com o `h1` como
          primeiro filho, a navegacao logo abaixo ganhava 32px de margem — e o
          `h1` e `sr-only`, entao ocupava zero na tela: sobrava so o espaco, e a
          barra descia sem nada visivel acima dela. */}
      <h1 className="sr-only">Central de ajuda — respostas rápidas para o dia a dia</h1>

      <main className={cn(PAGE_CONTAINER, "relative space-y-8 pt-1 pb-safe sm:pt-3")}>
        {/* Navegacao entre secoes com indicacao de onde a pessoa esta. Some
            durante a busca, quando o que importa e o resultado. */}
        <SectionAnchorNav sections={SECTIONS} />


        {accountActions.length > 0 ? (
          <SectionBlock
            id="conta"
            title="Cadastro, acesso e dados"
            description="Sua conta centraliza pedidos, dados da empresa, endereços e suporte."
            action={
              <Button asChild variant="outline" className="h-10 rounded-full px-4 text-[0.8125rem]">
                <Link to="/conta" viewTransition>
                  Abrir minha conta
                </Link>
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accountActions.map((action) => (
                <HelpActionCard key={action.id} action={action} />
              ))}
            </div>
          </SectionBlock>
        ) : null}

        {catalogActions.length > 0 ? (
          <SectionBlock
            id="catalogo"
            title="Como navegar melhor pelos produtos"
            description="A navegação foi feita para achar produtos rápido e reduzir atrito na compra."
            action={
              <Button asChild variant="outline" className="h-10 rounded-full px-4 text-[0.8125rem]">
                <Link to="/" viewTransition>
                  Ir ao catálogo
                </Link>
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {catalogActions.map((action) => (
                <HelpActionCard key={action.id} action={action} />
              ))}
            </div>
          </SectionBlock>
        ) : null}

          <SectionBlock
            id="como-funciona"
            title="Fluxo rápido de compra"
            description="O caminho mais simples do catálogo até o pedido enviado."
          >
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isLast = index === STEPS.length - 1;

                const content = (
                  <>
                    {/* Trilho que liga um passo ao seguinte: transforma quatro
                        caixas soltas numa sequencia legivel. */}
                    {!isLast ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-[-0.375rem] top-9 hidden h-px w-3 bg-border xl:block"
                      />
                    ) : null}

                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <StepIcon className="h-4 w-4" />
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-semibold text-primary-foreground ring-2 ring-card">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    </div>

                    <p className="mt-3 flex-1 text-[0.8125rem] leading-5 text-muted-foreground">{step.description}</p>

                    {step.cta ? (
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                        {step.cta}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : null}
                  </>
                );

                const baseClass =
                  "group relative flex h-full min-h-[156px] flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm";

                return (
                  <li key={step.title} className="contents">
                    {step.to ? (
                      <Link
                        to={step.to}
                        viewTransition
                        className={cn(
                          baseClass,
                          "transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        )}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={baseClass}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <p className="text-sm font-semibold text-foreground">Importante no envio</p>
              <ul className="mt-2 space-y-1.5">
                {ORDER_NOTES.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-[0.8125rem] leading-6 text-muted-foreground">
                    <span aria-hidden="true" className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </SectionBlock>

        {faqs.length > 0 ? (
          <SectionBlock
            id="pedidos"
            title="Perguntas frequentes"
            description="As respostas cobrem pedido, conta, catálogo e atendimento."
            action={
              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem]">
                {faqs.length} pergunta(s)
              </Badge>
            }
          >
            {/* Multi-expand: permite comparar respostas sem que abrir uma feche a
                anterior, que e o comportamento recomendado para FAQ. */}
            <Accordion type="multiple" value={openFaqIds} onValueChange={setOpenFaqIds} className="w-full">
              {faqs.map((item, index) => (
                <AccordionItem key={item.id} value={item.id} className="border-border/70">
                  <AccordionTrigger className="gap-3 py-4 text-left text-sm font-semibold text-foreground hover:no-underline">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold tabular-nums text-primary ring-1 ring-primary/15">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 text-left">
                        {item.question}
                      </span>
                    </span>
                  </AccordionTrigger>
                  {/* Alinha a resposta com o texto da pergunta, e nao com o
                      numero, para a leitura nao voltar para a margem. */}
                  <AccordionContent className="pb-4 pl-10 text-[0.8125rem] leading-6 text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionBlock>
        ) : null}

          <SectionBlock
            id="atendimento"
            title="Fale com a equipe"
            description="Quando precisar de ajuda direta, use um dos canais abaixo."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <a
                href={COMPANY.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-[88px] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    WhatsApp
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{COMPANY.whatsapp}</p>
                </div>
                <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              </a>

              <a
                href={`tel:${COMPANY.phone.replace(/\D/g, "")}`}
                className="group flex min-h-[88px] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Telefone
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{COMPANY.phone}</p>
                </div>
                <Phone className="h-4 w-4 shrink-0 text-primary" />
              </a>

              <a
                href={`mailto:${COMPANY.email}`}
                className="group flex min-h-[88px] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">E-mail</p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{COMPANY.email}</p>
                </div>
                <Mail className="h-4 w-4 shrink-0 text-primary" />
              </a>
            </div>

            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Horário de atendimento</p>
                <p className="text-sm leading-6 text-muted-foreground">{COMPANY.hours}</p>
                <p className="text-xs leading-5 text-muted-foreground">{COMPANY.address}</p>
              </div>
            </div>
          </SectionBlock>

        <section className="rounded-[1.35rem] border border-primary/20 bg-primary/5 p-5 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Não achou o que procurava?</p>
                <p className="text-[0.8125rem] leading-5 text-muted-foreground">
                  Chame a equipe no WhatsApp — respondemos no horário comercial.
                </p>
              </div>
            </div>
            <Button asChild className="h-11 w-full rounded-full px-5 sm:w-auto">
              <a href={COMPANY.whatsappLink} target="_blank" rel="noreferrer">
                Falar com o atendimento
              </a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
