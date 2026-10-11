import {
  MemoryStick,
  HardDrive,
  Keyboard,
  Mouse,
  Laptop,
  Printer,
  Cpu,
  Monitor,
  Package,
  Headphones,
  Wifi,
  Wrench,
  type LucideProps,
} from "lucide-react";

const ICONS: Record<string, typeof Package> = {
  RAM: MemoryStick,
  SSD: HardDrive,
  ALMACENAMIENTO: HardDrive,
  TECLADO: Keyboard,
  TECLADOS: Keyboard,
  MOUSE: Mouse,
  MOUSES: Mouse,
  LAPTOP: Laptop,
  LAPTOPS: Laptop,
  IMPRESORA: Printer,
  IMPRESORAS: Printer,
  PC: Cpu,
  COMPUTADORAS: Cpu,
  MONITOR: Monitor,
  MONITORES: Monitor,
  AUDIO: Headphones,
  AUDIFONOS: Headphones,
  AURICULARES: Headphones,
  REDES: Wifi,
  CONECTIVIDAD: Wifi,
  REPUESTOS: Wrench,
  COMPONENTES: Cpu,
};

/**
 * A proper component (not a bare lookup returning a component reference) —
 * picking the icon happens inside this component's own render, which is
 * the shape the React Compiler's static-components check expects.
 */
export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  const norm = (category || "").toUpperCase().trim();
  const Icon = ICONS[norm] ?? Package;
  return <Icon {...props} />;
}
