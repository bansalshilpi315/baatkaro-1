export const DEVELOPER_BUG_EMAIL = 'bansalansh315@gmail.com';
export const DEVELOPER_NAME = 'Ansh Bansal';
export const DEVELOPER_ROLE_BADGE = 'CREATOR & LEAD DEVELOPER';
export const DEVELOPER_HOBBIES: readonly string[] = [
  '3D Web Game Dev',
  '2D & 3D Character Animation',
  'Interactive Coding',
  'Creative Tech Experiments',
];
export const DEVELOPER_VISION_NOTE =
  "Hi! I'm Ansh Bansal — I love building 3D browser games, animating characters, and turning creative ideas into playable worlds. I created DESI DANGAL with a simple goal: to fuse classic arcade fighting energy with relatable desi characters, school & mohalla legends, and over-the-top superpowers that anyone can play instantly right in their browser without heavy downloads.";

export interface BugReportDeviceContext {
  viewportWidth?: number;
  viewportHeight?: number;
  orientation?: string;
}

export function buildBugReportMailtoUrl(
  description: string,
  device: BugReportDeviceContext = {},
): string {
  const trimmed = description.trim();
  const width =
    typeof device.viewportWidth === 'number' && Number.isFinite(device.viewportWidth)
      ? Math.round(device.viewportWidth)
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 0;
  const height =
    typeof device.viewportHeight === 'number' && Number.isFinite(device.viewportHeight)
      ? Math.round(device.viewportHeight)
      : typeof window !== 'undefined'
        ? window.innerHeight
        : 0;
  const orientation =
    device.orientation ??
    (width > 0 && height > 0 ? (width >= height ? 'Landscape' : 'Portrait') : 'Unknown');

  const lines = [
    trimmed || '(Describe what happened, which fighter/stage, and steps to reproduce)',
    '',
    '--- Device Info ---',
    `Screen: ${width > 0 && height > 0 ? `${width}x${height}` : 'Unknown'} (${orientation})`,
    'Game: DESI DANGAL',
  ];

  const subject = encodeURIComponent('DESI DANGAL - Bug Report');
  const body = encodeURIComponent(lines.join('\n'));
  return `mailto:${DEVELOPER_BUG_EMAIL}?subject=${subject}&body=${body}`;
}
