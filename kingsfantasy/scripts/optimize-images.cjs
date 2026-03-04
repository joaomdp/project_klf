const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets', 'images');

const targets = [
  path.join(ASSETS_DIR, 'backgrounds', 'fundo-capa-liga.jpg'),
  path.join(ASSETS_DIR, 'backgrounds', 'skt-back.jpg'),
  path.join(ASSETS_DIR, 'logo', 'jogos-sabado.jpg'),
  path.join(ASSETS_DIR, 'logo', 'jogos-domingo.jpg')
];

const ensureExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
};

const optimizeJpeg = async (filePath, { maxWidth, quality }) => {
  const image = sharp(filePath);
  const meta = await image.metadata();
  const width = meta.width && meta.width > maxWidth ? maxWidth : meta.width;

  const output = await image
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(filePath, output);
  const sizeKb = (output.length / 1024).toFixed(1);
  console.log(`Optimized ${path.basename(filePath)} -> ${sizeKb} KB`);
};

const run = async () => {
  targets.forEach(ensureExists);

  await optimizeJpeg(targets[0], { maxWidth: 1920, quality: 72 });
  await optimizeJpeg(targets[1], { maxWidth: 1920, quality: 75 });
  await optimizeJpeg(targets[2], { maxWidth: 1600, quality: 75 });
  await optimizeJpeg(targets[3], { maxWidth: 1600, quality: 75 });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
