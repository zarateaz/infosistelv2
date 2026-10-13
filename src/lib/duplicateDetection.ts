/**
 * Zero-margin-of-error duplicate product detection system.
 * Designed specifically for hardware, computer parts, peripherals, and electronics catalogs.
 *
 * Checks:
 * 1. Barcode match (exact, trimmed, leading zeros normalized).
 * 2. Exact name match (case-insensitive, whitespace trimmed).
 * 3. Normalized name match (accents/diacritics stripped, punctuation cleaned).
 * 4. Word-sorted match (e.g. "ADAPTADOR TP-LINK TL-WN725N" vs "TP-LINK ADAPTADOR TL-WN725N").
 * 5. Distinctive model code match (e.g. TL-WN725N, US320, V15, G502, B450M, RTX 3060, L3250).
 * 6. Key token containment (when all core terms of one name are present in another).
 * 7. Token overlap (Jaccard similarity >= 75% on distinctive non-stop words).
 * 8. Variant protection: Differentiates legitimate variants like 8GB vs 16GB, Negro vs Cyan, 1m vs 2m.
 */

export interface ProductSummary {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  message?: string;
  reason?:
    | "barcode"
    | "exact_name"
    | "normalized_name"
    | "word_permutation"
    | "model_code"
    | "containment"
    | "high_similarity";
  existingProduct?: ProductSummary;
}

const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "para",
  "con",
  "sin",
  "en",
  "por",
  "y",
  "o",
  "a",
  "al",
]);

/**
 * Normalizes text: strips accents/diacritics, lowercase, collapses spaces, removes non-alphanumeric chars.
 */
export function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits normalized text into distinctive non-stop words.
 */
export function extractDistinctiveTokens(str: string): string[] {
  const norm = normalizeText(str);
  if (!norm) return [];
  return norm
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

/**
 * Extracts tech model codes (e.g. "TL-WN725N", "US320", "V15", "G502", "B450M", "70450", "T664120").
 */
export function extractModelCodes(str: string): string[] {
  if (!str) return [];
  const rawTokens = str
    .toUpperCase()
    .replace(/[(),;:"]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter(Boolean);

  const modelCodes = new Set<string>();
  for (const token of rawTokens) {
    const clean = token.replace(/[^A-Z0-9]/g, "");
    // Alphanumeric with both letters and numbers, length >= 3 (e.g. WN725N, US320, G502, B450, RTX3060)
    if (clean.length >= 3 && /[A-Z]/.test(clean) && /[0-9]/.test(clean)) {
      modelCodes.add(clean.toLowerCase());
    }
    // Part numbers / manufacturer codes: 5 or more digits (e.g. Ugreen 70450, Epson T664120)
    else if (/^\d{5,}$/.test(clean)) {
      modelCodes.add(clean.toLowerCase());
    }
  }
  return Array.from(modelCodes);
}

/**
 * Extracts variant indicators such as capacity (8GB, 16GB, 1TB), cable length (1m, 2m),
 * or ink colors (negro, cyan, magenta, amarillo).
 */
export function extractVariantAttributes(str: string): {
  capacities: Set<string>;
  colors: Set<string>;
} {
  const normalized = normalizeText(str);
  const capacities = new Set<string>();
  const colors = new Set<string>();

  // Capacity / length / wattage regex
  const capRegex = /\b(\d+(?:\.\d+)?)\s*(gb|tb|mb|hz|mhz|ghz|w|watts|v|volts|a|amp|m|mts|metros|cm|mm|mah)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = capRegex.exec(normalized)) !== null) {
    capacities.add(`${match[1]}${match[2].replace(/metros|mts/, "m")}`);
  }

  // Color variants regex
  const colorRegex = /\b(negro|black|cian|cyan|magenta|amarillo|yellow|azul|blue|rojo|red|blanco|white|gris|gray|grey|verde|green)\b/gi;
  while ((match = colorRegex.exec(normalized)) !== null) {
    const c = match[1].toLowerCase();
    if (c === "black") colors.add("negro");
    else if (c === "cyan") colors.add("cian");
    else if (c === "yellow") colors.add("amarillo");
    else if (c === "blue") colors.add("azul");
    else if (c === "red") colors.add("rojo");
    else if (c === "white") colors.add("blanco");
    else if (c === "gray" || c === "grey") colors.add("gris");
    else if (c === "green") colors.add("verde");
    else colors.add(c);
  }

  return { capacities, colors };
}

/**
 * Checks if two products have conflicting variant attributes (e.g. 8GB vs 16GB, Negro vs Amarillo).
 * If they do, they are different products and should NOT be flagged as duplicates.
 */
function haveConflictingVariants(a: string, b: string): boolean {
  const varsA = extractVariantAttributes(a);
  const varsB = extractVariantAttributes(b);

  // If both specify capacities, and they have no overlap -> conflicting
  if (varsA.capacities.size > 0 && varsB.capacities.size > 0) {
    let hasOverlap = false;
    for (const cap of varsA.capacities) {
      if (varsB.capacities.has(cap)) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) return true;
  }

  // If both specify colors, and they have no overlap -> conflicting
  if (varsA.colors.size > 0 && varsB.colors.size > 0) {
    let hasOverlap = false;
    for (const col of varsA.colors) {
      if (varsB.colors.has(col)) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) return true;
  }

  return false;
}

/**
 * Evaluates whether an input product matches an existing catalog product.
 */
export function evaluateDuplicateMatch(
  input: { name: string; barcode?: string | null },
  candidate: ProductSummary
): DuplicateDetectionResult {
  // 1. Barcode check
  const inputBarcode = input.barcode?.trim();
  const candBarcode = candidate.barcode?.trim();
  if (inputBarcode && candBarcode) {
    const normInputBc = inputBarcode.replace(/^0+/, "");
    const normCandBc = candBarcode.replace(/^0+/, "");
    if (inputBarcode === candBarcode || (normInputBc && normInputBc === normCandBc)) {
      return {
        isDuplicate: true,
        reason: "barcode",
        message: `Coincidencia exacta por código de barras ("${candidate.barcode}") con "${candidate.name}".`,
        existingProduct: candidate,
      };
    }
  }

  const rawInputName = input.name?.trim();
  const rawCandName = candidate.name?.trim();
  if (!rawInputName || !rawCandName) {
    return { isDuplicate: false };
  }

  // 2. Exact match (case insensitive)
  if (rawInputName.toLowerCase() === rawCandName.toLowerCase()) {
    return {
      isDuplicate: true,
      reason: "exact_name",
      message: `El producto ya se encuentra en el inventario con el mismo nombre ("${candidate.name}").`,
      existingProduct: candidate,
    };
  }

  const normInput = normalizeText(rawInputName);
  const normCand = normalizeText(rawCandName);

  // 3. Normalized match
  if (normInput === normCand) {
    return {
      isDuplicate: true,
      reason: "normalized_name",
      message: `El producto ya se encuentra en el inventario ("${candidate.name}").`,
      existingProduct: candidate,
    };
  }

  // Before fuzzy/model matching, ensure variants don't conflict (e.g. 8GB vs 16GB)
  if (haveConflictingVariants(rawInputName, rawCandName)) {
    return { isDuplicate: false };
  }

  // 4. Word-sorted match (permutation)
  const tokensInput = extractDistinctiveTokens(rawInputName);
  const tokensCand = extractDistinctiveTokens(rawCandName);

  if (tokensInput.length > 0 && tokensCand.length > 0) {
    const sortedInput = [...tokensInput].sort().join(" ");
    const sortedCand = [...tokensCand].sort().join(" ");
    if (sortedInput === sortedCand) {
      return {
        isDuplicate: true,
        reason: "word_permutation",
        message: `Mismo producto con diferente orden de palabras ("${candidate.name}").`,
        existingProduct: candidate,
      };
    }
  }

  // 5. Model code matching
  const modelsInput = extractModelCodes(rawInputName);
  const modelsCand = extractModelCodes(rawCandName);

  if (modelsInput.length > 0 && modelsCand.length > 0) {
    for (const mInput of modelsInput) {
      if (modelsCand.includes(mInput)) {
        // If they share a model code and at least 1 other token OR brand
        const setCand = new Set(tokensCand);
        const sharedTokens = tokensInput.filter((t) => setCand.has(t));

        if (sharedTokens.length >= 1) {
          return {
            isDuplicate: true,
            reason: "model_code",
            message: `Mismo modelo de producto detectado (${mInput.toUpperCase()}) en "${candidate.name}".`,
            existingProduct: candidate,
          };
        }
      }
    }
  }

  // 6. Token containment (all distinctive tokens of the shorter title are present in the longer one)
  const setInput = new Set(tokensInput);
  const setCand = new Set(tokensCand);

  if (tokensInput.length >= 2 && tokensCand.length >= 2) {
    const inputInCand = tokensInput.every((t) => setCand.has(t));
    const candInInput = tokensCand.every((t) => setInput.has(t));

    if (inputInCand || candInInput) {
      return {
        isDuplicate: true,
        reason: "containment",
        message: `El producto ya se encuentra registrado bajo el nombre "${candidate.name}".`,
        existingProduct: candidate,
      };
    }
  }

  // 7. Token overlap (Jaccard similarity >= 75% on distinctive tokens)
  if (tokensInput.length >= 3 && tokensCand.length >= 3) {
    const intersection = tokensInput.filter((t) => setCand.has(t));
    const minLen = Math.min(tokensInput.length, tokensCand.length);
    const overlapRatio = intersection.length / minLen;

    if (overlapRatio >= 0.75) {
      return {
        isDuplicate: true,
        reason: "high_similarity",
        message: `Alta similitud (${Math.round(overlapRatio * 100)}% coincidencia) con "${candidate.name}".`,
        existingProduct: candidate,
      };
    }
  }

  return { isDuplicate: false };
}
