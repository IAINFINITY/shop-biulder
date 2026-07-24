import { useEffect, useMemo, useState, type LucideIcon, type ReactNode } from "react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COMPANY = {
  phone: "(49) 3433-5400",
  whatsapp: "(49) 2020-9980",
  whatsappLink: "https://wa.me/554920209980",
  email: "atendimento@amaiss.com.br",
  hours: "Seg a Sex, 7:30 às 17:00",
  address: "Rua Lauro Muller, 60, Matinho · Xanxerê/SC",
};

type HelpTopic = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "pedidos",
    title: "Pedidos",
    description: "Monte o carrinho, revise os dados e finalize a solicitação.",
    icon: ShoppingBag,
    keywords: ["pedido", "carrinho", "finalizar", "comprar"],
  },
  {
    id: "conta",
    title: "Conta e acesso",
    description: "Dados da empresa, login, senha e informações do cadastro.",
    icon: UserRound,
    keywords: ["conta", "senha", "login", "cadastro", "acesso"],
  },
  {
    id: "catalogo",
    title: "Catálogo",
    description: "Busca, filtros, detalhes e informações dos produtos.",
    icon: Package,
    keywords: ["catalogo", "produto", "busca", "filtro", "imagem"],
  },
  {
    id: "entrega",
    title: "Entrega",
    description: "Endereço, validação e orientação sobre a finalização.",
    icon: Truck,
    keywords: ["entrega", "endereco", "cep", "frete"],
  },
  {
    id: "seguranca",
    title: "Segurança",
    description: "Boas práticas para manter acesso e dados protegidos.",
    icon: ShieldCheck,
    keywords: ["seguranca", "privacidade", "dados", "acesso"],
  },
];

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
      "Se tiver dificuldade de acesso, use a área de conta ou fale com nosso atendimento para orientação. Quando disponível, a própria conta também permite ajustes de senha.",
    keywords: ["senha", "acesso", "login", "recuperar"],
  },
  {
    id: "catalogo-produtos",
    question: "Não achei um produto. Como procurar melhor?",
    answer:
      "Use a busca do catálogo, filtre por tipo ou família e abra a página do produto para ver informações detalhadas e imagens.",
    keywords: ["produto", "buscar", "catalogo", "filtro", "imagem"],
  },
  {
    id: "entrega-dados",
    question: "Por que preciso preencher o endereço completo?",
    answer:
      "O endereço ajuda a validar a solicitação e deixar o pedido pronto para conferência. Quanto mais completo, mais rápido o atendimento consegue seguir com a análise.",
    keywords: ["endereco", "cep", "entrega", "cadastro"],
  },
  {
    id: "atendimento-contato",
    question: "Como falar com atendimento?",
    answer:
      "Você pode falar com a equipe por WhatsApp, telefone ou e-mail dentro do horário comercial.",
    keywords: ["atendimento", "whatsapp", "telefone", "email", "contato"],
  },
];

const STEPS = [
  { title: "Escolha os itens", description: "Pesquise, filtre e abra o produto desejado." },
  { title: "Monte o carrinho", description: "Adicione quantidades, revise e siga para o pedido." },
  { title: "Confirme os dados", description: "Confira empresa, CNPJ e endereço antes de enviar." },
  { title: "Aguarde o retorno", description: "O pedido segue para processamento e validação." },
];

function matchesQuery(textParts: string[], query: string) {
  if (!query) return true;
  return textParts.some((part) => part.toLowerCase().includes(query));
}

const SECTION_ACCENTS = {
  primary: {
    frame: "border-border/70 bg-card shadow-sm",
    badge: "border-border/70 bg-card/95 text-foreground",
    title: "text-primary",
    strip: "from-border/70 via-border/30 to-transparent",
  },
  amber: {
    frame: "border-border/70 bg-card shadow-sm",
    badge: "border-border/70 bg-card/95 text-foreground",
    title: "text-foreground",
    strip: "from-border/70 via-border/30 to-transparent",
  },
  sky: {
    frame: "border-border/70 bg-card shadow-sm",
    badge: "border-border/70 bg-card/95 text-foreground",
    title: "text-foreground",
    strip: "from-border/70 via-border/30 to-transparent",
  },
  emerald: {
    frame: "border-border/70 bg-card shadow-sm",
    badge: "border-border/70 bg-card/95 text-foreground",
    title: "text-foreground",
    strip: "from-border/70 via-border/30 to-transparent",
  },
  violet: {
    frame: "border-border/70 bg-card shadow-sm",
    badge: "border-border/70 bg-card/95 text-foreground",
    title: "text-foreground",
    strip: "from-border/70 via-border/30 to-transparent",
  },
} as const;

function SectionBlock({
  id,
  eyebrow,
  title,
  description,
  children,
  accent = "primary",
  titleClassName,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  accent?: keyof typeof SECTION_ACCENTS;
  titleClassName?: string;
}) {
  const tone = SECTION_ACCENTS[accent];

  return (
    <section id={id} className="scroll-mt-[calc(var(--page-header-shell-height,88px)+1rem)]">
      <div className="mb-3 space-y-2">
        <h2 className={cn("text-xl font-semibold tracking-tight text-black dark:text-black sm:text-2xl", titleClassName)}>{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <div className={cn("overflow-hidden rounded-[1.35rem] border p-4 shadow-sm sm:rounded-[1.75rem] sm:p-6 lg:p-8", tone.frame)}>
        {children}
      </div>
    </section>
  );
}

export default function Help() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const filteredTopics = useMemo(
    () => HELP_TOPICS.filter((topic) => matchesQuery([topic.title, topic.description, ...topic.keywords], normalizedQuery)),
    [normalizedQuery],
  );

  const filteredFaqs = useMemo(
    () => FAQS.filter((faq) => matchesQuery([faq.question, faq.answer, ...faq.keywords], normalizedQuery)),
    [normalizedQuery],
  );

  return (
    <div className="relative min-h-screen bg-muted/40 pb-32 sm:pb-[10rem]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-200px] h-96 w-96 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute right-[-100px] top-40 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <main className="relative w-full space-y-8 px-3 py-4 pb-safe sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/95 p-4 shadow-sm sm:rounded-[1.75rem] sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,color-mix(in_oklch,var(--muted-foreground)_6%,transparent),transparent_24%),radial-gradient(circle_at_15%_80%,color-mix(in_oklch,var(--muted-foreground)_4%,transparent),transparent_22%)]" />
          <div className="space-y-4 sm:space-y-5">
            <div className="space-y-2 sm:space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground">Central de ajuda</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Respostas rápidas para o dia a dia.
              </h1>
              <p className="max-w-2xl text-[13px] sm:text-sm leading-6 sm:leading-7 text-muted-foreground sm:text-base">
                Use a busca para encontrar o assunto certo, como pedido, conta, catálogo ou atendimento.
              </p>
            </div>

            <div className="relative max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por pedido, senha, entrega, catálogo..."
                className="h-12 rounded-2xl border-border/70 bg-background pl-11 text-sm shadow-none focus-visible:ring-primary/30"
              />
            </div>
          </div>
        </section>

        <SectionBlock
          id="atalhos"
          eyebrow=""
          title="Seções mais consultadas"
          description="Clique para ir direto ao assunto."
          accent="primary"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {HELP_TOPICS.map((topic) => {
              const Icon = topic.icon;
              const visible = filteredTopics.some((item) => item.id === topic.id);
              if (!visible) return null;

              return (
                <a
                  key={topic.id}
                  href={`#${topic.id}`}
                  className="group flex h-full min-h-[152px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{topic.title}</p>
                      <p className="text-[13px] leading-5 text-muted-foreground">{topic.description}</p>
                    </div>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    Ver seção
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </a>
              );
            })}
          </div>
        </SectionBlock>

        <SectionBlock
          id="atendimento"
          eyebrow="Atendimento"
          title="Fale com a equipe"
          description="Quando precisar de ajuda direta, use um dos canais abaixo."
          accent="primary"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
            <div className="space-y-3">
              <a
                href={COMPANY.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[72px] items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/20"
              >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
                  WhatsApp
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{COMPANY.whatsapp}</p>
              </div>
              <MessageSquare className="h-4 w-4 text-primary" />
            </a>

            <a
              href={`tel:${COMPANY.phone.replace(/\D/g, "")}`}
              className="flex min-h-[72px] items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/20"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Telefone</p>
                <p className="mt-1 text-sm font-medium text-foreground">{COMPANY.phone}</p>
              </div>
              <Phone className="h-4 w-4 text-primary" />
            </a>

            <a
              href={`mailto:${COMPANY.email}`}
              className="flex min-h-[72px] items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/20"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">E-mail</p>
                <p className="mt-1 text-sm font-medium text-foreground">{COMPANY.email}</p>
              </div>
              <Mail className="h-4 w-4 text-primary" />
            </a>
            </div>

            <div className="flex min-h-[116px] items-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Horário de atendimento</p>
                  <p className="text-sm leading-6 text-muted-foreground">{COMPANY.hours}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{COMPANY.address}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock
          id="como-funciona"
          eyebrow="Como funciona"
          title="Fluxo rápido de compra"
          description="O caminho mais simples do catálogo até o pedido enviado."
          accent="primary"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, index) => {
              const tone = [
                "border-border/70 bg-card/95",
                "border-border/70 bg-card/95",
                "border-border/70 bg-card/95",
                "border-border/70 bg-card/95",
              ][index] ?? "border-border/70 bg-card/95";

              return (
                <div
                  key={step.title}
                  className={cn("flex h-full min-h-[144px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm", tone)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                      <span className="text-[11px] font-bold">0{index + 1}</span>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Passo</p>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-5 text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <p className="text-sm font-semibold text-foreground">Importante no envio</p>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              O pedido é montado no catálogo, conferido no checkout e depois segue para atendimento. Pagamento e
              condições comerciais são alinhados com o consultor após o envio.
            </p>
          </div>
        </SectionBlock>

        <SectionBlock
          id="pedidos"
          eyebrow="Perguntas frequentes"
          title="Dúvidas mais comuns"
          description="As respostas abaixo cobrem o fluxo de pedido, conta, catálogo e atendimento."
          accent="primary"
        >
          <div className="rounded-2xl border border-border/70 bg-card px-4 sm:px-5 shadow-sm">
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((item, index) => (
                  <AccordionItem key={item.id} value={item.id} className="border-border/70">
                    <AccordionTrigger className="py-4 text-left text-sm font-semibold text-foreground hover:no-underline">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-primary/15">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 text-left">{item.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-[13px] leading-6 text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="py-10 text-center">
                <HelpCircle className="mx-auto h-10 w-10 text-primary/40" />
                <p className="mt-3 text-sm font-medium text-foreground">Nenhum resultado encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tente buscar por outro termo ou fale com atendimento.
                </p>
                </div>
              )}
          </div>
        </SectionBlock>

        <SectionBlock
          id="conta"
          eyebrow="Conta"
          title="Cadastro, acesso e dados"
          description="Sua conta centraliza pedidos, dados da empresa, endereços e suporte."
          accent="primary"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex h-full min-h-[124px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <LogIn className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Acesso</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Entre com seu login para ver pedidos, ajustar dados e seguir com o atendimento.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[124px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Pedidos</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Acompanhe o histórico pelo menu da conta e confira os detalhes enviados.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[124px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Endereço</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Mantenha o endereço completo e atualizado para agilizar o processamento.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[124px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Senha</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Use o fluxo de conta para ajustes de senha quando disponível ou fale com atendimento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock
          id="catalogo"
          eyebrow="Catálogo"
          title="Como navegar melhor pelos produtos"
          description="A navegação foi feita para achar produtos rápido e reduzir atrito na compra."
          accent="primary"
          titleClassName="!text-black dark:!text-black"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex h-full min-h-[116px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black dark:text-black">Busca</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Procure por nome, descrição ou código do produto.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[116px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black dark:text-black">Filtros</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Filtre por tipo, família e ordenação para chegar mais rápido no item certo.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[116px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black dark:text-black">Detalhes</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Clique no produto para ver imagens, descrição e informações de apoio.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full min-h-[116px] flex-col justify-center rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black dark:text-black">Carrinho</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Revise quantidades e observações antes de seguir para a finalização.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionBlock>
      </main>
    </div>
  );
}
