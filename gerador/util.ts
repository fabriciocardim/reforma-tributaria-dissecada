import type { Dispositivo } from "../captura/ler.ts";

export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function subarvore(porId: Map<string, Dispositivo>, raiz: Dispositivo): Dispositivo[] {
  const saida: Dispositivo[] = [];
  const visitar = (d: Dispositivo): void => {
    saida.push(d);
    for (const f of d.filhos) {
      const filho = porId.get(f);
      if (filho) visitar(filho);
    }
  };
  visitar(raiz);
  return saida;
}

/** id de nó da estrutura → trecho seguro do endereço. */
export const idUrl = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, "-");
