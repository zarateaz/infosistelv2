/**
 * Zero-margin-of-error duplicate product detection system.
 * Designed specifically for hardware, computer parts, peripherals, and electronics catalogs.
 *
 * Checks:
 * 1. Barcode match (exact, trimmed, leading zeros normalized).
 * 2. Exact name match (case-insensitive, whitespace trimmed).
 * 3. Normalized name match (accents/diacritics stripped, punctuation cleaned).
 * 4. Word-sorted match (e.g. "ADAPTADOR TP-LINK TL-WN725N" vs "TP-LINK ADAPTADOR TL-WN725N").
 * 5. Distinctive model code match with brand verification (e.g. TL-WN725N, US320, V15, G502, B450M, RTX 3060, L3250).
 * 6. Brand conflict protection: Logitech vs Razer, Epson vs HP, Ugreen vs Baseus NEVER match.
 * 7. Variant protection: Differentiates legitimate variants like 8GB vs 16GB, Negro vs Cyan, 1m vs 2m.
 * 8. Zero false positives on generic phrases (e.g. "Mouse Inalámbrico" will NEVER match "Mouse Inalámbrico Logitech M170").
 */

export interface ProductSummary {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price?: number;
  costPrice?: number | null;
  stock?: number;
  image?: string | null;
  images?: string | null;
  description?: string | null;
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
 * Common hardware & tech brands in Peru and international catalogs.
 */
export const KNOWN_BRANDS = [
  "logitech",
  "razer",
  "redragon",
  "teraware",
  "halion",
  "micronics",
  "cybertel",
  "marvo",
  "t-dagger",
  "tdagger",
  "vsg",
  "corsair",
  "hyperx",
  "kingston",
  "adata",
  "crucial",
  "samsung",
  "sandisk",
  "western digital",
  "wd",
  "seagate",
  "toshiba",
  "asus",
  "gigabyte",
  "msi",
  "asrock",
  "zotac",
  "evga",
  "intel",
  "amd",
  "nvidia",
  "lenovo",
  "hp",
  "dell",
  "acer",
  "apple",
  "xiaomi",
  "huawei",
  "epson",
  "canon",
  "brother",
  "tp-link",
  "tplink",
  "d-link",
  "dlink",
  "mercusys",
  "tenda",
  "ubiquiti",
  "mikrotik",
  "ugreen",
  "baseus",
  "anker",
  "belkin",
  "philips",
  "sony",
  "lg",
  "viewsonic",
  "benq",
  "aoc",
  "terabyte",
  "antryx",
  "gamemax",
  "cougar",
  "cooler master",
  "thermaltake",
  "deepcool",
  "nzxt",
  "evotec",
  "advance",
  "klip xtreme",
  "forza",
  "apc",
  "cdp",
  "hikvision",
  "dahua",
  "ezviz",
  "imou",
  "genius",
  "havit",
  "kolke",
  "argom",
  "lexar",
  "pny",
  "patriot",
  "teamgroup",
  "biostar",
  "colorful",
  "palit",
  "xfx",
  "sapphire",
  "powercolor",
];

/**
 * Generic technical specifications and standards that must NEVER be treated as hardware model codes.
 */
const GENERIC_SPEC_TOKENS = new Set([
  // Memory types & buses
  "ddr",
  "ddr2",
  "ddr3",
  "ddr4",
  "ddr5",
  "gddr5",
  "gddr6",
  "lpddr4",
  "lpddr5",
  "ram",
  "rom",
  "sodimm",
  "dimm",
  // USB & connector standards
  "usb",
  "usb1",
  "usb2",
  "usb3",
  "usb30",
  "usb31",
  "usb32",
  "usb4",
  "typec",
  "usbc",
  "micro",
  "microusb",
  "otg",
  // Storage & PCIe
  "sata",
  "sata1",
  "sata2",
  "sata3",
  "m2",
  "nvme",
  "pcie",
  "pcie3",
  "pcie4",
  "pcie5",
  "pci",
  "ide",
  "ssd",
  "hdd",
  // Video & audio
  "hdmi",
  "hdmi2",
  "hdmi20",
  "hdmi21",
  "vga",
  "dvi",
  "dp",
  "dp12",
  "dp14",
  "displayport",
  "rj45",
  "aux",
  "jack",
  "rca",
  // Resolutions & frequencies
  "4k",
  "2k",
  "8k",
  "1080p",
  "720p",
  "1440p",
  "fhd",
  "qhd",
  "uhd",
  "hd",
  "60hz",
  "75hz",
  "90hz",
  "100hz",
  "120hz",
  "144hz",
  "165hz",
  "180hz",
  "240hz",
  "360hz",
  // Wireless
  "wifi",
  "wifi5",
  "wifi6",
  "wifi6e",
  "wifi7",
  "bt",
  "bt5",
  "bt50",
  "bt51",
  "bt52",
  "bt53",
  "bluetooth",
  "24g",
  "24ghz",
  "5g",
  "5ghz",
  // Network cable standards
  "cat5",
  "cat5e",
  "cat6",
  "cat6a",
  "cat7",
  "cat8",
  "utp",
  "ftp",
  "stp",
  // Lighting & panel tech
  "rgb",
  "argb",
  "led",
  "ips",
  "va",
  "tn",
  "oled",
  "amoled",
  // Form factors
  "atx",
  "matx",
  "microatx",
  "itx",
  "miniitx",
  "sfx",
  // Generations & tiers
  "gen1",
  "gen2",
  "gen3",
  "gen4",
  "gen5",
  "gen6",
  "gen7",
  "gen8",
  "gen9",
  "gen10",
  "gen11",
  "gen12",
  "gen13",
  "gen14",
  "i3",
  "i5",
  "i7",
  "i9",
  "r3",
  "r5",
  "r7",
  "r9",
  "core",
  "ryzen",
  // Common adjectives
  "pro",
  "max",
  "plus",
  "mini",
  "ultra",
  "slim",
  "lite",
  "super",
  "air",
  "prime",
  "gaming",
  "gamer",
  // Electrical & capacities
  "32bit",
  "64bit",
  "12v",
  "5v",
  "9v",
  "19v",
  "20v",
  "220v",
  "110v",
  "100w",
  "65w",
  "45w",
  "30w",
  "20w",
  "18w",
  "15w",
  "10w",
  "5w",
  "1tb",
  "2tb",
  "4tb",
  "500gb",
  "480gb",
  "256gb",
  "250gb",
  "240gb",
  "128gb",
  "120gb",
  "512gb",
  "64gb",
  "32gb",
  "16gb",
  "8gb",
  "4gb",
  "2gb",
  "1gb",
  "1m",
  "15m",
  "18m",
  "2m",
  "3m",
  "5m",
  "10m",
  "15m",
  "20m",
  "25m",
  "30m",
  "50m",
  "100m",
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
 * Extracts a recognizable brand name from text if present.
 */
export function extractBrand(str: string): string | null {
  const norm = ` ${normalizeText(str)} `;
  for (const b of KNOWN_BRANDS) {
    const brandNorm = normalizeText(b);
    if (norm.includes(` ${brandNorm} `)) {
      return brandNorm;
    }
  }
  return null;
}

/**
 * Extracts REAL tech model codes (e.g. "TL-WN725N", "US320", "V15", "G502", "B450M", "70450", "L3250", "T664").
 * Filtered against generic spec tokens (no DDR4, USB3, CAT6, etc.).
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
    const clean = token.replace(/[^A-Z0-9]/g, "").toLowerCase();
    if (!clean || GENERIC_SPEC_TOKENS.has(clean)) continue;

    // Alphanumeric with both letters and numbers, length >= 3 (e.g. WN725N, US320, G502, B450, RTX3060, L3250)
    if (clean.length >= 3 && /[a-z]/.test(clean) && /[0-9]/.test(clean)) {
      modelCodes.add(clean);
    }
    // Specific manufacturer part numbers: 5 or more digits (e.g. Ugreen 70450, Epson T664120)
    // Exclude common calendar years (2020-2030)
    else if (/^\d{5,}$/.test(clean) && !/^202[0-9]$/.test(clean)) {
      modelCodes.add(clean);
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
 * ZERO MARGIN OF ERROR: Never flags a generic phrase (e.g. "Mouse Inalámbrico")
 * as a duplicate of a specific branded/model product, nor different brands or models.
 */
export function evaluateDuplicateMatch(
  input: { name: string; barcode?: string | null },
  candidate: ProductSummary
): DuplicateDetectionResult {
  // 1. Barcode check (100% indisputable physical SKU match)
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

  // 4. Conflicting brands check (e.g. Logitech vs Razer, Epson vs HP, Ugreen vs Baseus)
  const brandInput = extractBrand(rawInputName);
  const brandCand = extractBrand(rawCandName);
  if (brandInput && brandCand && brandInput !== brandCand) {
    return { isDuplicate: false };
  }

  // 5. Conflicting variants check (e.g. 8GB vs 16GB, Negro vs Amarillo, 1M vs 2M)
  if (haveConflictingVariants(rawInputName, rawCandName)) {
    return { isDuplicate: false };
  }

  const tokensInput = extractDistinctiveTokens(rawInputName);
  const tokensCand = extractDistinctiveTokens(rawCandName);

  // 6. Word-sorted permutation match (exact same tokens, different word order)
  // Both must have the same number of tokens so no extra hardware words are ignored.
  if (tokensInput.length > 0 && tokensCand.length > 0 && tokensInput.length === tokensCand.length) {
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

  // 7. Specific Model Code matching
  const modelsInput = extractModelCodes(rawInputName);
  const modelsCand = extractModelCodes(rawCandName);

  // If BOTH specify model codes and share at least one
  if (modelsInput.length > 0 && modelsCand.length > 0) {
    for (const mInput of modelsInput) {
      if (modelsCand.includes(mInput)) {
        return {
          isDuplicate: true,
          reason: "model_code",
          message: `Mismo modelo de producto detectado (${mInput.toUpperCase()}) en "${candidate.name}".`,
          existingProduct: candidate,
        };
      }
    }
    // If both specified model codes but have NO overlap (e.g. US320 vs 70444, or G502 vs G203)
    // they are definitely DIFFERENT products!
    return { isDuplicate: false };
  }

  // If ONE specified a specific brand or model code, but the other did NOT,
  // DO NOT treat them as duplicates! (e.g. "Mouse Inalámbrico" vs "Mouse Inalámbrico Logitech M170")
  if (
    (modelsInput.length > 0 && modelsCand.length === 0) ||
    (modelsCand.length > 0 && modelsInput.length === 0) ||
    (brandInput && !brandCand) ||
    (!brandInput && brandCand)
  ) {
    return { isDuplicate: false };
  }

  // 8. High token overlap (ONLY when neither has distinct brands/models,
  // token counts are very close, and Jaccard similarity is >= 85%)
  if (tokensInput.length >= 4 && tokensCand.length >= 4) {
    const setCand = new Set(tokensCand);
    const setUnion = new Set([...tokensInput, ...tokensCand]);
    const intersection = tokensInput.filter((t) => setCand.has(t));
    const jaccard = intersection.length / setUnion.size;

    // Diff in token count must be at most 1 to prevent short generic matching long specific
    const lengthDiff = Math.abs(tokensInput.length - tokensCand.length);
    if (lengthDiff <= 1 && jaccard >= 0.85) {
      return {
        isDuplicate: true,
        reason: "high_similarity",
        message: `Alta similitud (${Math.round(jaccard * 100)}% coincidencia) con "${candidate.name}".`,
        existingProduct: candidate,
      };
    }
  }

  return { isDuplicate: false };
}
