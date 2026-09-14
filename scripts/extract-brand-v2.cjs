// Deterministic extraction from the approved board; no tracing or generated shapes.
const sharp = require('../apps/main/node_modules/sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const archive = path.resolve(root, '../../01_资料库/资料_静眠森/03_参考素材/品牌视觉');
const source = path.join(archive, '静眠森品牌视觉方案_v2_2026-09-13.png');
const background = [247, 249, 251];

async function extract(region) {
  const { data, info } = await sharp(source).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    const j = (y * info.width + x) * 4;
    const rgb = [...data.subarray(i, i + 3)];
    if (Math.min(...rgb) > 225) continue;
    let alpha = 1;
    let color = rgb;
    if (rgb[0] > 95) {
      let nearest = Infinity;
      let foreground = [47, 71, 86];
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const xx = x + dx, yy = y + dy, distance = dx * dx + dy * dy;
        if (xx < 0 || yy < 0 || xx >= info.width || yy >= info.height || distance >= nearest) continue;
        const k = (yy * info.width + xx) * 3;
        if (data[k] < 80) { nearest = distance; foreground = [...data.subarray(k, k + 3)]; }
      }
      const vector = background.map((b, k) => b - foreground[k]);
      alpha = Math.max(0, Math.min(1, vector.reduce((sum, v, k) => sum + v * (background[k] - rgb[k]), 0) / vector.reduce((sum, v) => sum + v * v, 0)));
      color = rgb.map((c, k) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * background[k]) / alpha))));
    }
    rgba.set([...color, Math.round(alpha * 255)], j);
  }
  return { rgba, width: info.width, height: info.height };
}

async function save(asset, base, light) {
  const data = Buffer.from(asset.rgba);
  if (light) for (let i = 0; i < data.length; i += 4) data.set([247, 249, 251], i);
  const image = sharp(data, { raw: { width: asset.width, height: asset.height, channels: 4 } });
  await image.png().toFile(base + '.png');
  await image.webp({ lossless: true }).toFile(base + '.webp');
}

(async () => {
  const mark = await extract({ left: 460, top: 46, width: 202, height: 232 });
  const lockup = await extract({ left: 426, top: 46, width: 266, height: 365 });
  for (const app of ['main', 'jingmiansen']) {
    const dir = path.join(root, 'apps', app);
    for (const tone of ['dark', 'light']) {
      await save(mark, path.join(dir, 'public/brand/site-mark-' + tone), tone === 'light');
      if (app === 'jingmiansen') await save(lockup, path.join(dir, 'public/projects/jingmiansen/brand/jingmiansen-lockup-' + tone), tone === 'light');
    }
    for (const [name, size, height] of [['icon.png', 64, 52], ['apple-icon.png', 180, 140]]) {
      const input = await sharp(path.join(dir, 'public/brand/site-mark-light.png')).resize({ height }).toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: '#2F4756' } }).composite([{ input, gravity: 'centre' }]).png().toFile(path.join(dir, 'app', name));
    }
  }
  console.log('Updated both apps: mark 202×232, lockup 266×365, favicon 64×64, Apple icon 180×180.');
})();
