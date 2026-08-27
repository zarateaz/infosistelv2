import { MemoryStick, HardDrive, Keyboard, Mouse, Laptop, Printer, Cpu, Monitor, Package, type LucideProps } from "lucide-react";

const ICONS: Record<string, typeof Package> = {
  RAM: MemoryStick,
  SSD: HardDrive,
  TECLADO: Keyboard,
  MOUSE: Mouse,
  LAPTOPS: Laptop,
  IMPRESORAS: Printer,
  PC: Cpu,
  MONITORES: Monitor,
};

/**
 * A proper component (not a bare lookup returning a component reference) —
 * picking the icon happens inside this component's own render, which is
 * the shape the React Compiler's static-components check expects.
 */
export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  const Icon = ICONS[category.toUpperCase()] ?? Package;
  return <Icon {...props} />;
}
