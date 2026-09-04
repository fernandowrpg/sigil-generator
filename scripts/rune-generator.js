import { Rand } from "./rng.js";
import { generateLore } from "./lore-generator.js";

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;

const INK_COLORS = [
  "#1c1a17", // black ink
  "#5a2020", // dark red / dried blood
  "#1e2a44", // deep indigo
  "#2c1e44", // violet
  "#22421e", // dark moss green
  "#4a3418"  // sepia brown
];

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function pointAt(radius, angleDeg, cx = CX, cy = CY) {
  const a = toRad(angleDeg);
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Builds one procedural rune as an SVG markup string.
 * Deterministic: the same seed always produces the same rune.
 */
export function buildRuneSVG(seed) {
  const rand = new Rand(seed);
  const color = rand.pick(INK_COLORS);
  const parts = [];

  const baseStroke = rand.float(1.6, 2.6);

  // --- Outer ring(s) --------------------------------------------------
  const ringCount = rand.int(1, 3);
  const ringRadii = [];
  let lastRadius = rand.float(105, 128);
  for (let i = 0; i < ringCount; i++) {
    ringRadii.push(lastRadius);
    lastRadius -= rand.float(10, 18);
  }
  for (const r of ringRadii) {
    const dashed = rand.bool(0.35);
    parts.push(
      `<circle cx="${CX}" cy="${CY}" r="${fmt(r)}" fill="none" stroke="${color}" ` +
        `stroke-width="${fmt(baseStroke * (dashed ? 0.8 : 1))}" ` +
        (dashed ? `stroke-dasharray="${fmt(r * 0.09)} ${fmt(r * 0.06)}" ` : "") +
        `/>`
    );
  }

  // --- Anchor points around the main ring -----------------------------
  const mainRadius = ringRadii[0] * rand.float(0.72, 0.86);
  const n = rand.int(7, 13);
  const step = 360 / n;
  const anchors = [];
  for (let i = 0; i < n; i++) {
    const jitter = rand.float(-step * 0.12, step * 0.12);
    const angle = i * step + jitter - 90;
    anchors.push({ ...pointAt(mainRadius, angle), angle });
  }

  // --- Sigil path: connect a random subset of anchors in random order --
  const k = rand.int(Math.min(4, n), n);
  const order = rand.shuffle(anchors.map((_, i) => i)).slice(0, k);
  const closeLoop = rand.bool(0.5);
  const usedInPath = new Set(order);

  let d = "";
  order.forEach((idx, i) => {
    const p = anchors[idx];
    if (i === 0) {
      d += `M ${fmt(p.x)} ${fmt(p.y)} `;
    } else {
      const prev = anchors[order[i - 1]];
      if (rand.bool(0.3)) {
        // gentle curved flourish between two points
        const mx = (prev.x + p.x) / 2;
        const my = (prev.y + p.y) / 2;
        const nx = -(p.y - prev.y);
        const ny = p.x - prev.x;
        const norm = Math.hypot(nx, ny) || 1;
        const bulge = rand.float(-14, 14);
        const cxp = mx + (nx / norm) * bulge;
        const cyp = my + (ny / norm) * bulge;
        d += `Q ${fmt(cxp)} ${fmt(cyp)} ${fmt(p.x)} ${fmt(p.y)} `;
      } else {
        d += `L ${fmt(p.x)} ${fmt(p.y)} `;
      }
    }
  });
  if (closeLoop && order.length > 2) d += "Z";
  parts.push(
    `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="${fmt(
      baseStroke * 1.15
    )}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  // --- Radial spokes from the centre to some anchors -------------------
  anchors.forEach((p, i) => {
    if (!usedInPath.has(i) && rand.bool(0.35)) {
      parts.push(
        `<line x1="${CX}" y1="${CY}" x2="${fmt(p.x)}" y2="${fmt(p.y)}" ` +
          `stroke="${color}" stroke-width="${fmt(baseStroke * 0.6)}" stroke-linecap="round"/>`
      );
    }
  });

  // --- Node decorations --------------------------------------------------
  anchors.forEach((p) => {
    const roll = rand.float();
    if (roll < 0.22) {
      parts.push(`<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(rand.float(2.5, 4))}" fill="${color}"/>`);
    } else if (roll < 0.42) {
      parts.push(
        `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(rand.float(4, 6.5))}" fill="none" stroke="${color}" stroke-width="${fmt(
          baseStroke * 0.7
        )}"/>`
      );
    } else if (roll < 0.6) {
      // tick perpendicular to the radius
      const tickLen = rand.float(6, 11);
      const a1 = toRad(p.angle + 90);
      const a2 = toRad(p.angle - 90);
      const x1 = p.x + Math.cos(a1) * tickLen;
      const y1 = p.y + Math.sin(a1) * tickLen;
      const x2 = p.x + Math.cos(a2) * tickLen;
      const y2 = p.y + Math.sin(a2) * tickLen;
      parts.push(
        `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${color}" stroke-width="${fmt(
          baseStroke * 0.7
        )}" stroke-linecap="round"/>`
      );
    } else if (roll < 0.75) {
      // small triangle pointing outward
      const size = rand.float(5, 8);
      const tip = pointAt(mainRadius + size, p.angle);
      const baseA = pointAt(mainRadius - size * 0.4, p.angle - 6);
      const baseB = pointAt(mainRadius - size * 0.4, p.angle + 6);
      parts.push(
        `<polygon points="${fmt(tip.x)},${fmt(tip.y)} ${fmt(baseA.x)},${fmt(baseA.y)} ${fmt(baseB.x)},${fmt(
          baseB.y
        )}" fill="${color}"/>`
      );
    }
    // else: no decoration on this node
  });

  // --- Outer clock-style tick marks -------------------------------------
  if (rand.bool(0.6)) {
    const tickN = rand.pick([12, 16, 24]);
    const outerR = ringRadii[0];
    for (let i = 0; i < tickN; i++) {
      const angle = (360 / tickN) * i;
      const p1 = pointAt(outerR + 2, angle);
      const p2 = pointAt(outerR + 7, angle);
      parts.push(
        `<line x1="${fmt(p1.x)}" y1="${fmt(p1.y)}" x2="${fmt(p2.x)}" y2="${fmt(p2.y)}" stroke="${color}" stroke-width="1"/>`
      );
    }
  }

  // --- Centre ornament -----------------------------------------------
  const centreRoll = rand.float();
  if (centreRoll < 0.4) {
    parts.push(`<circle cx="${CX}" cy="${CY}" r="${fmt(rand.float(4, 7))}" fill="${color}"/>`);
  } else if (centreRoll < 0.75) {
    parts.push(
      `<circle cx="${CX}" cy="${CY}" r="${fmt(rand.float(6, 10))}" fill="none" stroke="${color}" stroke-width="${fmt(
        baseStroke
      )}"/>`
    );
  }

  const svg =
    `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
    parts.join("") +
    `</svg>`;

  return { svg, color };
}

/**
 * Full rune generation: visual SVG plus a generated name / power / description.
 */
export function generateRune(seed) {
  const { svg, color } = buildRuneSVG(seed);
  const lore = generateLore(seed);
  return { svg, color, seed, ...lore };
}
