export const PAYMENT_METHODS = ["EFECTIVO", "YAPE 1", "YAPE 2"] as const;

export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

export interface PaymentMethodDetail {
  id: PaymentMethodType;
  name: string;
  titular: string;
  phone?: string;
  formattedPhone?: string;
  labelSelect: string;
}

export const PAYMENT_METHOD_INFO: Record<PaymentMethodType, PaymentMethodDetail> = {
  EFECTIVO: {
    id: "EFECTIVO",
    name: "Efectivo",
    titular: "Caja Física",
    labelSelect: "EFECTIVO (Caja física)",
  },
  "YAPE 1": {
    id: "YAPE 1",
    name: "Yape 1",
    titular: "Edgar Caballero",
    phone: "964648202",
    formattedPhone: "964 648 202",
    labelSelect: "YAPE 1 — Edgar Caballero (964 648 202)",
  },
  "YAPE 2": {
    id: "YAPE 2",
    name: "Yape 2",
    titular: "Yape Caja",
    phone: "963193838",
    formattedPhone: "963 193 838",
    labelSelect: "YAPE 2 — Yape Caja (963 193 838)",
  },
};
