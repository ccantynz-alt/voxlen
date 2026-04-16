/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_CHECKOUT_PRO?: string;
  readonly VITE_STRIPE_CHECKOUT_PROFESSIONAL?: string;
  readonly VITE_STRIPE_CHECKOUT_LIFETIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
