import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const NAVY = '#0B1226';
const svg = await readFile('public/logo.svg');

const logoPng = (size) => sharp(svg, { density: Math.ceil((72 * size) / 256) }).resize(size, size).png().toBuffer();

async function plain(size, file) {
  await sharp(await logoPng(size)).toFile(file);
}

// Full-bleed navy background with the logo inset, for maskable and iOS icons.
async function padded(size, scale, file) {
  const logo = await logoPng(Math.round(size * scale));
  await sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(file);
}

async function og(file) {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B2A4A"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="520" y="310" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="104" fill="#FFFFFF">Kameramera</text>
    <text x="524" y="380" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#7DE3FF">Strike a pose. Fire the camera.</text>
  </svg>`);
  await sharp(bg)
    .composite([{ input: await logoPng(340), left: 140, top: 145 }])
    .png()
    .toFile(file);
}

await plain(192, 'public/icon-192.png');
await plain(512, 'public/icon-512.png');
await padded(512, 0.7, 'public/icon-maskable-512.png');
await padded(180, 0.8, 'public/apple-touch-icon.png');
await og('public/og-image.png');
console.log('Icons written to public/');
