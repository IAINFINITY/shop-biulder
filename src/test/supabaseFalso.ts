/**
 * Dublê do cliente Supabase para os testes de fumaça das páginas.
 *
 * ## Por que um proxy, e não um mock escrito à mão
 *
 * As páginas encadeiam a query de formas muito diferentes — `from().select()
 * .eq().order().limit()`, `rpc()`, `storage.from().getPublicUrl()`,
 * `channel().on().subscribe()`. Escrever cada combinação à mão daria um arquivo
 * maior que o que se quer testar, e ele quebraria a cada método novo.
 *
 * O proxy responde a **qualquer** método devolvendo a si mesmo, e a um `await`
 * devolvendo `{ data: [], error: null }`. É deliberadamente burro: estes testes
 * não verificam dado nenhum, verificam que a página **monta** — que é o que uma
 * remoção de código quebraria.
 *
 * ## O que ele NÃO faz
 *
 * Não simula erro, não simula linha vazia versus linha cheia, não simula tempo
 * real. Um dublê que inventasse esses casos passaria a afirmar coisas que o
 * Supabase de verdade não afirma — o mesmo cuidado que `setup.ts` registra
 * sobre os observadores inertes.
 */

const respostaVazia = { data: [], error: null, count: 0, status: 200 };
const respostaUnica = { data: null, error: null, status: 200 };

function criarCorrente(resposta: unknown) {
  const alvo = function () {
    return corrente;
  } as unknown as Record<string | symbol, unknown>;

  const corrente: unknown = new Proxy(alvo, {
    get(_destino, prop) {
      // `await corrente` — é aqui que a query "resolve".
      if (prop === "then") {
        return (aoResolver: (v: unknown) => unknown) => Promise.resolve(resposta).then(aoResolver);
      }
      if (prop === "catch" || prop === "finally") {
        return () => corrente;
      }
      // `maybeSingle`/`single` devolvem objeto, não lista.
      if (prop === "maybeSingle" || prop === "single") {
        return () => criarCorrente(respostaUnica);
      }
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return undefined;
      }
      return () => corrente;
    },
    apply() {
      return corrente;
    },
  });

  return corrente;
}

export function criarSupabaseFalso() {
  const canal = {
    on: () => canal,
    subscribe: () => canal,
    unsubscribe: () => Promise.resolve("ok"),
    send: () => Promise.resolve("ok"),
  };

  return {
    from: () => criarCorrente(respostaVazia),
    rpc: () => criarCorrente(respostaVazia),
    channel: () => canal,
    removeChannel: () => Promise.resolve("ok"),
    getChannels: () => [],
    storage: {
      from: () => ({
        getPublicUrl: (caminho: string) => ({ data: { publicUrl: `https://exemplo.test/${caminho}` } }),
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
        move: async () => ({ data: null, error: null }),
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
      updateUser: async () => ({ data: { user: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      mfa: {
        listFactors: async () => ({ data: { totp: [], all: [] }, error: null }),
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
        enroll: async () => ({ data: null, error: null }),
        challenge: async () => ({ data: null, error: null }),
        verify: async () => ({ data: null, error: null }),
        unenroll: async () => ({ data: null, error: null }),
      },
    },
  };
}
