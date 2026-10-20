// Generator ikon BlockDown: gaya datar dengan bayangan panjang. Tiga varian latar, satu komposisi:
// blok O kuning jatuh ke celah di tumpukan, dan begitu mendarat baris itu penuh (motif logo: blok yang baru jatuh).
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const C = 64, G = 4, X0 = 128, Y0 = 96, R = 8;
const pieces = [
  { color: "#E3C35A", cells: [[1, 0], [2, 0], [1, 1], [2, 1]] }, // O jatuh
  { color: "#E39A55", cells: [[0, 2], [0, 3], [0, 4], [1, 4]] }, // L
  { color: "#6CC489", cells: [[3, 2], [3, 3], [3, 4], [2, 4]] }, // J (hijau di ikon supaya kontras dengan latar biru)
];
const rect = ([cx, cy]) => ({ x: X0 + cx * C + G / 2, y: Y0 + cy * C + G / 2, s: C - G });

const block = (b, color) =>
  `<g><rect x="${b.x}" y="${b.y}" width="${b.s}" height="${b.s}" rx="${R}" fill="${color}"/>` +
  `<rect x="${b.x}" y="${b.y}" width="${b.s}" height="${b.s}" rx="${R}" fill="url(#shade)"/>` +
  `<rect x="${b.x + R / 2}" y="${b.y}" width="${b.s - R}" height="5" fill="#fff" opacity=".22"/>` +
  `<rect x="${b.x + R / 2}" y="${b.y + b.s - 6}" width="${b.s - R}" height="6" fill="#000" opacity=".25"/></g>`;

// Bayangan panjang 45 derajat: setiap sel ditarik ke kanan bawah sampai keluar latar.
const L = 600;
const shadow = (b) => {
  const { x, y, s } = b;
  return `<polygon points="${x},${y + s} ${x + s},${y} ${x + s + L},${y + L} ${x + L},${y + s + L}"/>` + `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
};

const SCALE = Number(process.env.SCALE ?? 1);
const variants = {
  biru: { bg: "#5B7CFA", shadow: "#4A68E0", shape: "square" },
  gelap: { bg: "#1E2530", shadow: "#151A22", shape: "square" },
  lingkaran: { bg: "#0F1217", disc: "#5B7CFA", shadow: "#4A68E0", shape: "circle" },
};

for (const [name, v] of Object.entries(variants)) {
  const cells = pieces.flatMap((p) => p.cells.map((c) => ({ b: rect(c), color: p.color })));
  const clipShape = v.shape === "circle" ? `<circle cx="256" cy="256" r="232"/>` : `<rect width="512" height="512"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<clipPath id="bg">${clipShape}</clipPath>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>
</defs>
<rect width="512" height="512" fill="${v.bg}"/>
${v.shape === "circle" ? `<circle cx="256" cy="256" r="232" fill="${v.disc}"/>` : ""}
<g clip-path="url(#bg)"><g transform="translate(256 256) scale(${SCALE}) translate(-256 -256)" fill="${v.shadow}">${cells.map((c) => shadow(c.b)).join("")}</g></g>
<g transform="translate(256 256) scale(${SCALE}) translate(-256 -256)">${cells.map((c) => block(c.b, c.color)).join("\n")}</g>
</svg>`;
  writeFileSync(`${OUT}/ikon-${name}.svg`, svg);
}
console.log("ok");
