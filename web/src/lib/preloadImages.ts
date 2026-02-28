import dragonGif from '../assets/dragon.gif';

const bundledImageModules = import.meta.glob('../assets/**/*.{png,jpg,jpeg,gif,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

let hasPreloaded = false;

export function preloadAppImages(): void {
  if (hasPreloaded || typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }
  hasPreloaded = true;

  const urls = new Set<string>([dragonGif, ...Object.values(bundledImageModules)]);

  for (const url of urls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}
