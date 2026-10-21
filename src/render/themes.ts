// Lima tema (PRD-6). Varian dipilih pemilik lewat pratinjau: Malam B, Neon garis B, Fajar B, Monokrom A.
// Tema hanya mengubah tampilan. Kontras teks lolos AA dan warna blok terbedakan (dicek sebelum rilis).
import type { ThemeId } from "../core/unlocks.ts";

/** solid: warna penuh. glass: kaca (kilau diagonal). neon: garis tepi menyala dengan isi samar. soft: sudut lebih bulat. */
export type BlockStyle = "solid" | "glass" | "neon" | "soft";

export interface Theme {
  id: ThemeId;
  /** Gaya gambar blok di atlas. */
  style: BlockStyle;
  /** Warna blok, indeks 1..7 = I O T S Z J L, 8 = Blok Pengisi (indeks 0 kosong). */
  blocks: readonly string[];
  /** Monokrom: warna piece yang sedang jatuh dan ghost-nya (semua jenis sama). */
  active?: string;
  grid: string;
  /** Variabel CSS yang diganti (lihat :root di styles.css). */
  css: Record<string, string>;
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: "classic",
    style: "solid",
    blocks: ["", "#5CC8D6", "#E3C35A", "#A57BD8", "#6CC489", "#E06C75", "#3F63C9", "#E39A55", "#F2F2F2"],
    grid: "rgba(230, 233, 239, 0.04)",
    css: {
      "--bg": "#0f1217", "--surface-1": "#161b22", "--surface-2": "#1e2530", "--text": "#e6e9ef",
      "--text-dim": "#8a93a3", "--accent": "#5b7cfa", "--on-accent": "#0f1217", "--line-control": "#8a93a3", "--line-deco": "#262f3d",
    },
  },
  night: {
    id: "night",
    style: "glass",
    blocks: ["", "#79E2F2", "#E8CF7A", "#A98BEB", "#84D9A0", "#EE8A9C", "#6B8CF0", "#F0A574", "#F4F7FF"],
    grid: "rgba(140, 190, 255, 0.06)",
    css: {
      "--bg": "#070a12", "--surface-1": "#0d1220", "--surface-2": "#141a2c", "--text": "#e3eaf7",
      "--text-dim": "#8b98b3", "--accent": "#6cb6ff", "--on-accent": "#070a12", "--line-control": "#8b98b3", "--line-deco": "#1f2840",
    },
  },
  neon: {
    id: "neon",
    style: "neon",
    blocks: ["", "#00E5FF", "#FFE45C", "#D86BFF", "#3DFF8F", "#FF4F7B", "#2E5BFF", "#FF9B3D", "#FFFFFF"],
    grid: "rgba(255, 255, 255, 0.05)",
    css: {
      "--bg": "#050507", "--surface-1": "#08080c", "--surface-2": "#121219", "--text": "#f2f2f7",
      "--text-dim": "#9a9ab0", "--accent": "#ff4fd8", "--on-accent": "#050507", "--line-control": "#9a9ab0", "--line-deco": "#22222c",
    },
  },
  dawn: {
    id: "dawn",
    style: "soft",
    blocks: ["", "#7FDDE8", "#EBD27A", "#B9A3EA", "#7ED9A6", "#F29595", "#5E9AE6", "#F4B07C", "#F2FBFB"],
    grid: "rgba(180, 240, 240, 0.05)",
    css: {
      "--bg": "#0b1618", "--surface-1": "#102024", "--surface-2": "#172b2f", "--text": "#e3f1f2",
      "--text-dim": "#8ea9ac", "--accent": "#4fd1c5", "--on-accent": "#0b1618", "--line-control": "#8ea9ac", "--line-deco": "#1f3439",
    },
  },
  mono: {
    id: "mono",
    style: "solid",
    blocks: ["", "#C9C9CF", "#E6E6EA", "#8E8E96", "#B0B0B8", "#6E6E76", "#5A5A62", "#A0A0A8", "#F2F2F2"],
    active: "#F2F2F2",
    grid: "rgba(255, 255, 255, 0.04)",
    css: {
      "--bg": "#0e0e0f", "--surface-1": "#151517", "--surface-2": "#1f1f22", "--text": "#ededef",
      "--text-dim": "#9696a0", "--accent": "#f2f2f2", "--on-accent": "#0e0e0f", "--line-control": "#9696a0", "--line-deco": "#2a2a2e",
    },
  },
};
