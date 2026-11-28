import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  PRELOAD_BRAND_URLS,
  PRELOAD_LOGO_URL,
  STARTUP_ASSET_MANIFEST,
  TOTAL_STARTUP_PRELOAD_ASSETS,
} from './assetPreloader';

const ROOT_DIR = process.cwd();

test('index.html declares all official ./logo.png favicons, Apple Touch Icon, manifest, theme-color, social share tags, and CrazyGames SDK v3 script', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

  assert.ok(html.includes('<link rel="icon" type="image/png" sizes="32x32" href="./logo.png" />'));
  assert.ok(html.includes('<link rel="icon" type="image/png" sizes="192x192" href="./logo.png" />'));
  assert.ok(html.includes('<link rel="icon" type="image/png" sizes="512x512" href="./logo.png" />'));
  assert.ok(html.includes('<link rel="shortcut icon" type="image/png" href="./logo.png" />'));
  assert.ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="./logo.png" />'));
  assert.ok(html.includes('<link rel="manifest" href="./manifest.json" />'));
  assert.ok(html.includes('<meta name="theme-color" content="#1a120b" />'));
  assert.ok(
    html.includes('<meta property="og:title" content="DESI DANGAL — 3D Arcade Fighting Arena" />'),
  );
  assert.ok(html.includes('<meta property="og:image" content="./logo.png" />'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary" />'));
  assert.ok(html.includes('<meta name="twitter:image" content="./logo.png" />'));
  assert.ok(
    html.includes('<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'),
  );
});

test('public/manifest.json defines valid PWA configuration with relative ./logo.png icons for 192x192 and 512x512', () => {
  const manifestPath = path.join(ROOT_DIR, 'public', 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true, 'public/manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    orientation: string;
    background_color: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };

  assert.equal(manifest.name, 'DESI DANGAL');
  assert.equal(manifest.short_name, 'Desi Dangal');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.background_color, '#1a120b');
  assert.equal(manifest.theme_color, '#f59e0b');
  assert.deepEqual(manifest.icons, [
    { src: './logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: './logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ]);
});

test('startup asset preloader includes ./logo.png in manifest and totals 28 preloaded assets', () => {
  assert.equal(PRELOAD_LOGO_URL, './logo.png');
  assert.deepEqual([...PRELOAD_BRAND_URLS], ['./logo.png']);
  assert.deepEqual([...STARTUP_ASSET_MANIFEST.brandAssets], ['./logo.png']);
  assert.equal(TOTAL_STARTUP_PRELOAD_ASSETS, 28);
});

test('in-game branding surfaces wire GameLogoBadge (./logo.png) into LoadingScreen, TitleScreen, SettingsModal, and VictoryScreen', () => {
  const badgeSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'src', 'components', 'GameLogoBadge.tsx'),
    'utf8',
  );
  assert.ok(badgeSrc.includes("export const GAME_LOGO_URL = './logo.png'"));

  const surfaces: Array<{ file: string; testId: string }> = [
    { file: 'LoadingScreen.tsx', testId: 'preloader-logo' },
    { file: 'TitleScreen.tsx', testId: 'title-logo-emblem' },
    { file: 'SettingsModal.tsx', testId: 'settings-dev-logo' },
    { file: 'VictoryScreen.tsx', testId: 'victory-newspaper-seal' },
  ];

  for (const surface of surfaces) {
    const src = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', surface.file), 'utf8');
    assert.ok(
      src.includes('GameLogoBadge'),
      `${surface.file} must import and render GameLogoBadge`,
    );
    assert.ok(
      src.includes(`testId="${surface.testId}"`),
      `${surface.file} must include testId="${surface.testId}"`,
    );
  }
});
