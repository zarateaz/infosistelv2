/**
 * Zero-margin-of-error duplicate product detection system.
 * Designed specifically for hardware, computer parts, peripherals, and electronics catalogs.
 *
 * Checks:
 * 1. Barcode match (exact, trimmed, leading zeros normalized).
 * 2. Exact name match (case-insensitive, whitespace trimmed).
 * 3. Normalized name match (accents/diacritics stripped, punctuation cleaned).
 * 4. Canonical synonym & word-sorted match (e.g. "CAJA DE DISCO DURO UGREEN 2.5 SATA" vs "CASE DISCO DURO UGREEN 2.5 SATA").
 * 5. Distinctive model code match with brand & spec verification (checks both name and description).
 * 6. Brand conflict protection: Logitech vs Razer, Epson vs HP, Ugreen vs Cabletime NEVER match.
 * 7. Variant protection: Differentiates legitimate variants like 8GB vs 16GB, Negro vs Cyan, 1.5m vs 2m, 2.5" vs 3.5".
 * 8. Smart brand + product type + spec overlap for repeated AI photo scans of the same item.
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
  "uso",
  "tipo",
]);

/**
 * Canonical synonym map for Spanish/English hardware terms so AI scans of the same box
 * normalize to the same root token even if phrased slightly differently.
 */
const CANONICAL_SYNONYMS: Record<string, string> = {
  portatil: "laptop",
  portatiles: "laptop",
  notebook: "laptop",
  notebooks: "laptop",
  laptops: "laptop",
  celular: "celular",
  celulares: "celular",
  telefono: "celular",
  smartphone: "celular",
  movil: "celular",
  case: "caja",
  cofre: "caja",
  enclosure: "caja",
  carcasa: "caja",
  stand: "soporte",
  holder: "soporte",
  base: "soporte",
  soportes: "soporte",
  raton: "mouse",
  mouses: "mouse",
  mice: "mouse",
  teclados: "teclado",
  keyboard: "teclado",
  auricular: "audifono",
  auriculares: "audifono",
  audifonos: "audifono",
  headset: "audifono",
  headphone: "audifono",
  headphones: "audifono",
  altavoz: "parlante",
  altavoces: "parlante",
  parlantes: "parlante",
  bocina: "parlante",
  speaker: "parlante",
  speakers: "parlante",
  convertidor: "adaptador",
  adapter: "adaptador",
  adaptadores: "adaptador",
  cables: "cable",
  cord: "cable",
  inalambrico: "wireless",
  inalambrica: "wireless",
  carro: "auto",
  vehiculo: "auto",
  automovil: "auto",
  ventilacion: "rejilla",
  aire: "rejilla",
  desktop: "escritorio",
  plegable: "ajustable",
  regulable: "ajustable",
  pulgadas: "inch",
  pulgada: "inch",
};

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
  "cabletime",
  "vention",
  "orico",
  "zkteco",
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
  "jbl",
  "fifine",
  "boya",
  "wacom",
  "steren",
  "dixon",
  "teros",
  "fantech",
  "aula",
  "ajazz",
  "keychron",
  "akko",
];

/**
 * Generic technical specifications and standards that must NEVER be treated as hardware model codes.
 */
const GENERIC_SPEC_TOKENS = new Set([
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
  "cat5",
  "cat5e",
  "cat6",
  "cat6a",
  "cat7",
  "cat8",
  "utp",
  "ftp",
  "stp",
  "rgb",
  "argb",
  "led",
  "ips",
  "va",
  "tn",
  "oled",
  "amoled",
  "atx",
  "matx",
  "microatx",
  "itx",
  "miniitx",
  "sfx",
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
  "32bit",
  "64bit",
  "360",
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
  "20m",
  "25m",
  "30m",
  "50m",
  "100m",
  "10gbps",
  "5gbps",
  "18gbps",
  "48gbps",
  "100mbps",
  "1000mbps",
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
 * Splits normalized text into distinctive non-stop words, applying canonical tech synonyms.
 */
export function extractDistinctiveTokens(str: string): string[] {
  const norm = normalizeText(str);
  if (!norm) return [];
  const tokens = norm
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map((token) => CANONICAL_SYNONYMS[token] ?? token);
  return Array.from(new Set(tokens));
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
    // Skip pure measurements like 15m, 100w, 60hz, 360, etc.
    if (/^\d+(m|cm|mm|w|v|a|hz|gb|tb|mb|gbps|mbps|p|k)$/.test(clean)) continue;

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
 * Extracts fine-grained hardware and electronics technical specifications.
 */
export interface TechnicalSpecs {
  lengths: Set<string>;
  versions: Set<string>;
  resolutions: Set<string>;
  refreshRates: Set<string>;
  speeds: Set<string>;
  wattages: Set<string>;
  amperages: Set<string>;
  capacities: Set<string>;
  colors: Set<string>;
  portCounts: Set<string>;
  formFactors: Set<string>;
}

export function extractTechnicalSpecs(text: string): TechnicalSpecs {
  const lengths = new Set<string>();
  const versions = new Set<string>();
  const resolutions = new Set<string>();
  const refreshRates = new Set<string>();
  const speeds = new Set<string>();
  const wattages = new Set<string>();
  const amperages = new Set<string>();
  const capacities = new Set<string>();
  const colors = new Set<string>();
  const portCounts = new Set<string>();
  const formFactors = new Set<string>();

  if (!text) {
    return {
      lengths,
      versions,
      resolutions,
      refreshRates,
      speeds,
      wattages,
      amperages,
      capacities,
      colors,
      portCounts,
      formFactors,
    };
  }

  const raw = text.toLowerCase();

  // 1. Lengths / Measures (e.g. 1.5m, 1.8m, 2m, 3m, 5m, 10m, 50cm)
  const lengthRegex = /(?:^|[\s,;([/])(\d+(?:\.\d+)?)\s*(m|mts|metros|cm|mm)(?:$|[\s,;.)\]/])/gi;
  let match: RegExpExecArray | null;
  while ((match = lengthRegex.exec(raw)) !== null) {
    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("m") && unit !== "mm") {
      lengths.add(`${num}m`);
    } else if (unit === "cm") {
      lengths.add(`${num}cm`);
    } else if (unit === "mm") {
      lengths.add(`${num}mm`);
    }
  }

  // 2. Protocols and versions (HDMI 2.0 vs 2.1, USB 2.0 vs 3.0 vs 3.2, Cat5e vs Cat6, BT 5.0 vs 5.3)
  const hdmiRegex = /(?:^|[\s,;([/])(?:hdmi\s*(1\.4|2\.0|2\.1)|(?:1\.4|2\.0|2\.1)\s*hdmi)(?:$|[\s,;.)\]/])/gi;
  while ((match = hdmiRegex.exec(raw)) !== null) {
    versions.add(`hdmi_${match[1]}`);
  }
  const usbRegex = /(?:^|[\s,;([/])(?:usb\s*(2\.0|3\.0|3\.1|3\.2|4\.0)|(?:2\.0|3\.0|3\.1|3\.2|4\.0)\s*usb)(?:$|[\s,;.)\]/])/gi;
  while ((match = usbRegex.exec(raw)) !== null) {
    versions.add(`usb_${match[1]}`);
  }
  const ethRegex = /(?:^|[\s,;([/])(?:cat(?:egoria)?\s*(5e|5|6a|6|7|8)|cat(5e|5|6a|6|7|8))(?:$|[\s,;.)\]/])/gi;
  while ((match = ethRegex.exec(raw)) !== null) {
    versions.add(`cat_${match[1] || match[2]}`);
  }
  const btRegex = /(?:^|[\s,;([/])(?:bluetooth|bt)\s*(4\.0|4\.2|5\.0|5\.1|5\.2|5\.3|5\.4)(?:$|[\s,;.)\]/])/gi;
  while ((match = btRegex.exec(raw)) !== null) {
    versions.add(`bt_${match[1]}`);
  }
  const dpRegex = /(?:^|[\s,;([/])(?:displayport|dp)\s*(1\.2|1\.4|2\.0|2\.1)(?:$|[\s,;.)\]/])/gi;
  while ((match = dpRegex.exec(raw)) !== null) {
    versions.add(`dp_${match[1]}`);
  }

  // 3. Resolutions and refresh rates
  const resRegex = /(?:^|[\s,;([/])(4k|8k|2k|1080p|720p|1440p|fhd|qhd|uhd)(?:$|[\s,;.)\]/])/gi;
  while ((match = resRegex.exec(raw)) !== null) {
    resolutions.add(match[1]);
  }
  const hzRegex = /(?:^|[\s,;([/])(\d+)\s*hz(?:$|[\s,;.)\]/])/gi;
  while ((match = hzRegex.exec(raw)) !== null) {
    refreshRates.add(`${match[1]}hz`);
  }

  // 4. Speeds and bandwidths
  const speedRegex = /(?:^|[\s,;([/])(\d+(?:\.\d+)?)\s*(gbps|mbps)(?:$|[\s,;.)\]/])/gi;
  while ((match = speedRegex.exec(raw)) !== null) {
    speeds.add(`${parseFloat(match[1])}${match[2]}`);
  }

  // 5. Electrical: Wattage and Amperage
  const wRegex = /(?:^|[\s,;([/])(\d+(?:\.\d+)?)\s*(w|watts)(?:$|[\s,;.)\]/])/gi;
  while ((match = wRegex.exec(raw)) !== null) {
    wattages.add(`${parseFloat(match[1])}w`);
  }
  const aRegex = /(?:^|[\s,;([/])(\d+(?:\.\d+)?)\s*(a|amp|amperios)(?:$|[\s,;.)\]/])/gi;
  while ((match = aRegex.exec(raw)) !== null) {
    amperages.add(`${parseFloat(match[1])}a`);
  }

  // 6. Memory / Storage Capacities (8GB, 16GB, 512GB, 1TB, 2TB)
  const capRegex = /(?:^|[\s,;([/])(\d+)\s*(gb|tb|mb)(?:$|[\s,;.)\]/])/gi;
  while ((match = capRegex.exec(raw)) !== null) {
    capacities.add(`${match[1]}${match[2]}`);
  }

  // 7. Colors
  const colorRegex = /(?:^|[\s,;([/])(negro|black|cian|cyan|magenta|amarillo|yellow|azul|blue|rojo|red|blanco|white|gris|gray|grey|verde|green)(?:$|[\s,;.)\]/])/gi;
  while ((match = colorRegex.exec(raw)) !== null) {
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

  // 8. Port counts (4 en 1, 7 en 1, 4 puertos, 8 puertos)
  const portRegex = /(?:^|[\s,;([/])(\d+)\s*(?:en\s*1|in\s*1|puertos|ports)(?:$|[\s,;.)\]/])/gi;
  while ((match = portRegex.exec(raw)) !== null) {
    portCounts.add(`${match[1]}_ports`);
  }

  // 9. Disk / Screen form factors (2.5", 3.5", 15.6", 24", 27")
  const inchRegex = /(?:^|[\s,;([/])(2\.5|3\.5|13\.3|14|15\.6|16|17\.3|21\.5|24|27|32)\s*(?:"|''|pulgadas|inch)(?:$|[\s,;.)\]/])/gi;
  while ((match = inchRegex.exec(raw)) !== null) {
    formFactors.add(`${match[1]}_inch`);
  }

  return {
    lengths,
    versions,
    resolutions,
    refreshRates,
    speeds,
    wattages,
    amperages,
    capacities,
    colors,
    portCounts,
    formFactors,
  };
}

/**
 * Checks if two products have conflicting technical specifications.
 */
export function haveConflictingTechnicalSpecs(a: string, b: string): boolean {
  if (!a || !b) return false;
  const sA = extractTechnicalSpecs(a);
  const sB = extractTechnicalSpecs(b);

  const checkConflict = (setA: Set<string>, setB: Set<string>) => {
    if (setA.size > 0 && setB.size > 0) {
      for (const val of setA) {
        if (setB.has(val)) return false;
      }
      return true;
    }
    return false;
  };

  if (checkConflict(sA.lengths, sB.lengths)) return true;
  if (checkConflict(sA.versions, sB.versions)) return true;
  if (checkConflict(sA.resolutions, sB.resolutions)) return true;
  if (checkConflict(sA.refreshRates, sB.refreshRates)) return true;
  if (checkConflict(sA.speeds, sB.speeds)) return true;
  if (checkConflict(sA.wattages, sB.wattages)) return true;
  if (checkConflict(sA.amperages, sB.amperages)) return true;
  if (checkConflict(sA.capacities, sB.capacities)) return true;
  if (checkConflict(sA.colors, sB.colors)) return true;
  if (checkConflict(sA.portCounts, sB.portCounts)) return true;
  if (checkConflict(sA.formFactors, sB.formFactors)) return true;

  return false;
}

/**
 * Evaluates whether an input product matches an existing catalog product.
 * ZERO MARGIN OF ERROR: Takes into account both name and description.
 * If technical characteristics differ (length, speed, version, etc.), it is NEVER a duplicate.
 */
export function evaluateDuplicateMatch(
  input: { name: string; barcode?: string | null; description?: string | null },
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

  // Combined full text (name + description) for deep technical characteristic checking
  const inputFull = `${rawInputName} ${input.description ?? ""}`;
  const candFull = `${rawCandName} ${candidate.description ?? ""}`;

  // Conflicting technical specifications check (length, version, speed, wattage, etc.)
  if (haveConflictingTechnicalSpecs(inputFull, candFull)) {
    return { isDuplicate: false };
  }

  // 2. Exact match (case insensitive)
  if (rawInputName.toLowerCase() === rawCandName.toLowerCase()) {
    return {
      isDuplicate: true,
      reason: "exact_name",
      message: `El producto ya se encuentra en la tienda con el mismo nombre ("${candidate.name}").`,
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
      message: `El producto ya se encuentra en la tienda ("${candidate.name}").`,
      existingProduct: candidate,
    };
  }

  // 4. Conflicting brands check (e.g. Logitech vs Razer, Epson vs HP, Ugreen vs Cabletime)
  const brandInput = extractBrand(inputFull);
  const brandCand = extractBrand(candFull);
  if (brandInput && brandCand && brandInput !== brandCand) {
    return { isDuplicate: false };
  }

  const tokensInput = extractDistinctiveTokens(rawInputName);
  const tokensCand = extractDistinctiveTokens(rawCandName);

  // 5. Canonical word-sorted permutation match
  if (tokensInput.length > 0 && tokensCand.length > 0 && tokensInput.length === tokensCand.length) {
    const sortedInput = [...tokensInput].sort().join(" ");
    const sortedCand = [...tokensCand].sort().join(" ");
    if (sortedInput === sortedCand) {
      return {
        isDuplicate: true,
        reason: "word_permutation",
        message: `El producto ya se encuentra en la tienda ("${candidate.name}").`,
        existingProduct: candidate,
      };
    }
  }

  // 6. Specific Model Code matching (across both name and description)
  const modelsInputName = extractModelCodes(rawInputName);
  const modelsCandName = extractModelCodes(rawCandName);
  const modelsInputAll = extractModelCodes(inputFull);
  const modelsCandAll = extractModelCodes(candFull);

  if (modelsInputAll.length > 0 && modelsCandAll.length > 0) {
    for (const mInput of modelsInputAll) {
      if (modelsCandAll.includes(mInput)) {
        return {
          isDuplicate: true,
          reason: "model_code",
          message: `Mismo modelo exacto detectado (${mInput.toUpperCase()}) en "${candidate.name}".`,
          existingProduct: candidate,
        };
      }
    }
    // If both product NAMES explicitly state different model codes, they are different products
    if (modelsInputName.length > 0 && modelsCandName.length > 0) {
      return { isDuplicate: false };
    }
  }

  // If one specifies a brand and the other specifies no brand at all, do not match generic vs branded
  if ((brandInput && !brandCand) || (!brandInput && brandCand)) {
    return { isDuplicate: false };
  }

  // 7. Token overlap & containment check for repeated AI scans of the same product
  if (tokensInput.length >= 3 && tokensCand.length >= 3) {
    const setInput = new Set(tokensInput);
    const setCand = new Set(tokensCand);
    const setCandFull = new Set(extractDistinctiveTokens(candFull));
    const setInputFull = new Set(extractDistinctiveTokens(inputFull));

    const intersection = tokensInput.filter((t) => setCand.has(t));
    const unionSize = new Set([...tokensInput, ...tokensCand]).size;
    const jaccard = intersection.length / unionSize;
    const minLen = Math.min(tokensInput.length, tokensCand.length);
    const containment = intersection.length / minLen;

    // Cross-containment against full description tokens (when AI puts an extra word in description vs title)
    const inputInCandFull = tokensInput.filter((t) => setCandFull.has(t)).length / tokensInput.length;
    const candInInputFull = tokensCand.filter((t) => setInputFull.has(t)).length / tokensCand.length;

    // Primary product noun (first token, e.g. "soporte", "caja", "cable", "adaptador", "mouse", "laptop")
    const samePrimaryType = tokensInput[0] === tokensCand[0] || setCand.has(tokensInput[0]);

    if (brandInput && brandInput === brandCand && samePrimaryType) {
      if (
        jaccard >= 0.65 ||
        (containment >= 0.8 && minLen >= 4) ||
        (inputInCandFull >= 0.85 && candInInputFull >= 0.75)
      ) {
        return {
          isDuplicate: true,
          reason: "high_similarity",
          message: `El producto ya se encuentra en la tienda ("${candidate.name}").`,
          existingProduct: candidate,
        };
      }
    } else if (!brandInput && !brandCand) {
      const lengthDiff = Math.abs(tokensInput.length - tokensCand.length);
      if (lengthDiff <= 1 && jaccard >= 0.85) {
        return {
          isDuplicate: true,
          reason: "high_similarity",
          message: `El producto ya se encuentra en la tienda ("${candidate.name}").`,
          existingProduct: candidate,
        };
      }
    }
  }

  return { isDuplicate: false };
}
