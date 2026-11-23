/**
 * Auditoría de productos repetidos en TODO el catálogo.
 *
 * - "seguro": el comparador determinístico (mismo nombre, mismo modelo sin
 *   conflicto de variante, etc.) dice que son el mismo producto.
 * - "revisar": se parecen mucho pero hace falta que un humano (o la IA con las
 *   fotos) lo confirme. Las variantes reales (64GB vs 128GB, negro vs blanco,
 *   5V vs 12V, marcas distintas) NO aparecen.
 *
 * Se usa desde /taller-control/productos/duplicados y desde
 * scripts/auditar-productos-duplicados.ts.
 */
import {
  evaluateDuplicateMatch,
  rankSimilarProducts,
  extractDistinctiveTokens,
  extractModelCodes,
  type ProductSummary,
} from "@/lib/duplicateDetection";

export interface AuditProduct extends ProductSummary {
  itemNumber?: number;
}

export interface DuplicateGroup {
  /** Stable key: sorted ids joined with "|" */
  key: string;
  level: "seguro" | "revisar";
  products: AuditProduct[];
  /** Human-readable reasons, one per detected pair */
  reasons: string[];
}

// Generic words that should not, on their own, make two products "related"
const WEAK_TOKENS = new Set([
  "memoria", "cable", "adaptador", "caja", "soporte", "funda", "kit", "combo", "accesorio",
  "producto", "usb", "negro", "blanco", "gris", "azul", "rojo", "verde", "mouse", "teclado",
  "audifono", "parlante", "cargador", "laptop", "celular", "wireless", "gamer", "rgb", "led",
  "hdmi", "tipo", "c", "pc", "auto", "para", "de",
]);

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let p = this.parent.get(x)!;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function groupKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function findDuplicateGroups(products: AuditProduct[], reviewThreshold = 0.85): DuplicateGroup[] {
  const byId = new Map(products.map((p) => [p.id, p]));

  // Blocking: only compare products that share enough distinctive tokens or a model code.
  const index = new Map<string, string[]>();
  const keyCount = new Map<string, number>();
  for (const p of products) {
    const keys = new Set<string>([
      ...extractDistinctiveTokens(p.name).filter((t) => t.length >= 3 && !WEAK_TOKENS.has(t)),
      ...extractModelCodes(p.name).map((m) => `m:${m}`),
    ]);
    keyCount.set(p.id, keys.size);
    for (const k of keys) {
      const list = index.get(k) ?? [];
      list.push(p.id);
      index.set(k, list);
    }
  }

  const shared = new Map<string, { n: number; model: boolean }>();
  for (const [key, ids] of index) {
    if (ids.length < 2 || ids.length > 600) continue;
    const isModel = key.startsWith("m:");
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        const cur = shared.get(k) ?? { n: 0, model: false };
        cur.n++;
        if (isModel) cur.model = true;
        shared.set(k, cur);
      }
    }
  }
  const pairs: string[] = [];
  for (const [k, v] of shared) {
    const [a, b] = k.split("|");
    const minKeys = Math.min(keyCount.get(a) ?? 0, keyCount.get(b) ?? 0);
    // shares a model code, OR ≥2 distinctive words, OR every distinctive word of the shorter name
    if (v.model || v.n >= 2 || v.n >= minKeys) pairs.push(k);
  }

  const sure = new UnionFind();
  const sureEdges: [string, string, string][] = [];
  const reviewEdges: [string, string, string][] = [];

  for (const pair of pairs) {
    const [ida, idb] = pair.split("|");
    const a = byId.get(ida)!;
    const b = byId.get(idb)!;
    const m1 = evaluateDuplicateMatch({ name: a.name, description: a.description, barcode: a.barcode }, b);
    const m2 = m1.isDuplicate
      ? m1
      : evaluateDuplicateMatch({ name: b.name, description: b.description, barcode: b.barcode }, a);
    // Two products with DIFFERENT barcodes are different products by definition.
    const differentBarcodes = !!a.barcode && !!b.barcode && a.barcode.trim() !== b.barcode.trim();
    if (differentBarcodes) continue;

    if (m2.isDuplicate) {
      sure.union(ida, idb);
      sureEdges.push([ida, idb, m2.message ?? "Mismo producto"]);
      continue;
    }
    const ranked = rankSimilarProducts({ name: a.name, description: a.description }, [b], 1, reviewThreshold);
    if (ranked.length > 0) {
      reviewEdges.push([ida, idb, `Nombres muy parecidos (${Math.round(Math.min(1, ranked[0].score) * 100)}%)`]);
    }
  }

  const groups: DuplicateGroup[] = [];

  // Sure groups
  const sureComponents = new Map<string, Set<string>>();
  for (const [a, b] of sureEdges) {
    const root = sure.find(a);
    const set = sureComponents.get(root) ?? new Set<string>();
    set.add(a);
    set.add(b);
    sureComponents.set(root, set);
  }
  for (const [root, ids] of sureComponents) {
    const reasons = sureEdges
      .filter(([a]) => sure.find(a) === root)
      .map(([a, b, r]) => `${byId.get(a)!.name} ↔ ${byId.get(b)!.name}: ${r}`);
    groups.push({
      key: groupKey([...ids]),
      level: "seguro",
      products: [...ids].map((id) => byId.get(id)!),
      reasons,
    });
  }

  // Review groups (skip pairs already in the same sure group)
  const review = new UnionFind();
  const usedReview: [string, string, string][] = [];
  for (const edge of reviewEdges) {
    const [a, b] = edge;
    if (sure.find(a) === sure.find(b) && sureComponents.has(sure.find(a))) continue;
    review.union(a, b);
    usedReview.push(edge);
  }
  const reviewComponents = new Map<string, Set<string>>();
  for (const [a, b] of usedReview) {
    const root = review.find(a);
    const set = reviewComponents.get(root) ?? new Set<string>();
    set.add(a);
    set.add(b);
    reviewComponents.set(root, set);
  }
  for (const [root, ids] of reviewComponents) {
    const reasons = usedReview
      .filter(([a]) => review.find(a) === root)
      .map(([a, b, r]) => `${byId.get(a)!.name} ↔ ${byId.get(b)!.name}: ${r}`);
    groups.push({
      key: groupKey([...ids]),
      level: "revisar",
      products: [...ids].map((id) => byId.get(id)!),
      reasons,
    });
  }

  // Within each group: product with the most stock / oldest item number first (suggested to keep)
  for (const g of groups) {
    g.products.sort((x, y) => (y.stock ?? 0) - (x.stock ?? 0) || (x.itemNumber ?? 0) - (y.itemNumber ?? 0));
  }
  return groups.sort((x, y) => (x.level === y.level ? y.products.length - x.products.length : x.level === "seguro" ? -1 : 1));
}
