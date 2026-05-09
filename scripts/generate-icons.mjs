/**
 * Generates PWA icon PNG files using only Node.js built-ins (no dependencies).
 * Creates a chef-hat styled icon with a warm gradient feel.
 * Run once: node scripts/generate-icons.mjs
 */

import { createWriteStream, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// CRC32 lookup table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function makePNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const ihdr = chunk("IHDR", ihdrData);

  // Draw a rounded-square icon: warm primary blue bg + white circle
  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38; // white circle radius
  const cornerR = size * 0.22; // rounded corner radius for bg square

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // Rounded-rect check for background
      const dx = Math.max(Math.abs(x - cx) - (size / 2 - cornerR), 0);
      const dy = Math.max(Math.abs(y - cy) - (size / 2 - cornerR), 0);
      const inRoundedRect = Math.sqrt(dx * dx + dy * dy) <= cornerR;

      // White circle for icon symbol
      const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const inCircle = distCenter <= r;

      // Inner smaller circle (creates a ring effect)
      const inInnerCircle = distCenter <= r * 0.55;

      let red, green, blue;
      if (!inRoundedRect) {
        // Transparent-ish → white (background of page)
        red = 255;
        green = 255;
        blue = 255;
      } else if (inCircle && !inInnerCircle) {
        // White ring
        red = 255;
        green = 255;
        blue = 255;
      } else if (inInnerCircle) {
        // Primary color center
        red = 59;
        green = 130;
        blue = 246; // blue-500
      } else {
        // Background gradient (blue-500 → blue-600)
        const t = y / size;
        red = Math.round(59 + t * (37 - 59));
        green = Math.round(130 + t * (99 - 130));
        blue = Math.round(246 + t * (235 - 246));
      }

      const i = 1 + x * 3;
      row[i] = red;
      row[i + 1] = green;
      row[i + 2] = blue;
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = deflateSync(rawData);
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const sizes = [
  { size: 180, name: "apple-touch-icon.png" },
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 32, name: "favicon-32.png" },
];

for (const { size, name } of sizes) {
  const buf = makePNG(size);
  const dest = join(outDir, name);
  createWriteStream(dest).end(buf);
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log("Icons written to public/icons/");
