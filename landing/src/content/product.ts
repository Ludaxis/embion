export const BRAND = 'EMBION';
export const PRODUCT_CODE = 'EMB-01';
export const PRODUCT_NAME = 'Multimodal Perception Module';
export const SITE_URL = 'https://embion.vercel.app';

export const POSITIONING = 'The perception layer for embodied AI.';
export const PITCH =
  'EMB-01 fuses vision, depth, sound, and motion into one synchronized stream your code reads like a camera.';

export const BUILD_LOG_URL =
  'https://medium.com/@aakhv110/from-discrete-sensors-to-unified-perception-building-a-plug-and-play-multimodal-module-054c197cb266';

export const CONTACT_EMAIL = 'reza@ludaxis.io';
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('EMB-01')}`;
export const RESERVE_SUBJECT = 'EMB-01 dev kit — Batch One reservation';
export const MODULES_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('EMB-01 modules / OEM')}`;

/** Primary + secondary CTA, used site-wide. */
export const CTA = {
  primary: 'Reserve a dev kit',
  primaryShort: 'Reserve dev kit',
  primaryHref: '/devkit/',
  secondary: 'Read the docs',
  secondaryHref: '/developers/',
};

/** Top navigation, left to right. */
export const NAV = [
  { label: 'Product', href: '/' },
  { label: 'Developers', href: '/developers/' },
  { label: 'Research', href: '/research/' },
  { label: 'LeRobot', href: '/lerobot/' },
  { label: 'Datasets', href: '/datasets/' },
  { label: 'Story', href: '/story/' },
];

export const HERO = {
  h1a: 'Every sense.',
  h1b: 'One stream.',
  sub: `${PRODUCT_CODE} fuses vision, depth, sound, and motion into one synchronized stream your code reads like a camera. Built for the people teaching robots to understand the world.`,
  ctaPrimary: CTA.primary,
  ctaPrimaryHref: CTA.primaryHref,
  ctaSecondary: CTA.secondary,
  ctaSecondaryHref: CTA.secondaryHref,
};

export const STATS = [
  { value: '5', unit: '', label: 'sensing modalities' },
  { value: '67', unit: 'TOPS', label: 'on-device compute' },
  { value: '360', unit: '°', label: 'LiDAR field of view' },
  { value: '1', unit: '', label: 'synchronized stream out' },
];

export const PHILOSOPHY = {
  kicker: 'Why',
  line: 'Robots don’t have a body problem. They have a data problem.',
  body: 'Embodied AI is starved for synchronized multimodal data. The hard part isn’t building the body — it’s capturing what the body senses, in order, on one clock.',
};

export type Chapter = {
  id: string;
  anchor: string; // node name in the GLB
  kicker: string;
  title: string;
  body: string;
  specs: string[];
  side: 'left' | 'right';
};

/** The senses. Each caption: the sense, then the failure mode it covers. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'lidar',
    anchor: 'lidar-ld19',
    kicker: '01 · Range',
    title: 'Feels the room.',
    body: 'Geometry that doesn’t care about lighting. The LiDAR sweeps a full 360° plane at 4,500 samples per second, out to 12 meters — in the dark, in glare, behind your robot.',
    specs: ['360° FOV', '12 m range', '4,500 samples/s'],
    side: 'left',
  },
  {
    id: 'imu',
    anchor: 'imu',
    kicker: '02 · Motion',
    title: 'Knows how it’s moving.',
    body: 'Self-motion, so every other reading has context. Ten axes at 100 Hz — orientation, acceleration, heading — put vision, depth, and sound in a stable frame of reference.',
    specs: ['10-axis', '100 Hz', 'gyro · accel · mag · baro'],
    side: 'right',
  },
  {
    id: 'mics',
    anchor: 'mic-b',
    kicker: '03 · Sound',
    title: 'Hears what it can’t see.',
    body: 'Direction of sound, before line of sight. Three directional microphones place a voice behind your robot or a door around the corner by time-difference-of-arrival.',
    specs: ['3 directional mics', 'TDOA localization', 'spectrogram encoding'],
    side: 'left',
  },
  {
    id: 'camera',
    anchor: 'camera-ar0234',
    kicker: '04 · Vision',
    title: 'Sees the scene.',
    body: 'Sharp under motion, because robots move. A true global shutter captures 1920×1200 at up to 120 fps — no rolling-shutter smear, even at speed.',
    specs: ['1920 × 1200', '120 fps', 'global shutter'],
    side: 'right',
  },
  {
    id: 'tof',
    anchor: 'tof-8x8',
    kicker: '05 · Proximity',
    title: 'Reflexes.',
    body: 'Fast proximity, before vision has processed a frame. An 8×8 depth grid updates at up to 60 Hz across the near field the LiDAR plane misses.',
    specs: ['8 × 8 zones', '4 m reach', 'up to 60 Hz'],
    side: 'left',
  },
  {
    id: 'jetson',
    anchor: 'jetson',
    kicker: '06 · Compute',
    title: 'Fused before it leaves the device.',
    body: 'A Jetson Orin Nano Super runs acquisition, alignment, and encoding on board — 67 TOPS turning five raw feeds into one stream before your host reads a byte.',
    specs: ['67 TOPS', '8 GB LPDDR5', 'JetPack 6'],
    side: 'right',
  },
  {
    id: 'fusion',
    anchor: 'chassis-upper',
    kicker: '07 · One stream',
    title: 'Five senses. Complementary failure modes. One clock.',
    body: 'Every modality lands in the same synchronized frame. To your host it’s a camera: one cable, and anything that reads video reads your robot’s full sensory state.',
    specs: ['one shared clock', 'USB-C / HDMI out', 'reads as a standard camera'],
    side: 'left',
  },
];

/** Home — how it works. Three steps, huge type. */
export const HOW_IT_WORKS = {
  kicker: 'How it works',
  steps: [
    {
      title: 'Plug it in.',
      body: 'One USB-C cable. No driver zoo, no sensor plumbing.',
    },
    {
      title: 'It shows up as a camera.',
      body: 'Every modality, one synchronized stream, on any host that can read video.',
    },
    {
      title: 'Five lines of Python.',
      body: 'Decode, record, train. Export straight to LeRobot format.',
    },
  ],
};

/** Home — why one stream. */
export const WHY_ONE_STREAM = {
  kicker: 'Sync',
  title: 'Sensors disagree about time. Robots can’t afford that.',
  body: 'Fusing modalities after the fact means aligning clocks, interpolating timestamps, and praying. EMB-01 synchronizes at the source — on the device — so what you record is what actually happened, in order.',
  todo: '[TODO: sync precision] across all five modalities.',
};

/** Home — the data story. */
export const DATA_STORY = {
  kicker: 'Data',
  title: 'Robots learn from demonstrations. Demonstrations are data.',
  body: 'Today, a multimodal recording rig is three webcams, a LiDAR with its own driver, and a weekend of alignment scripts. EMB-01 is the rig, in one head. Record synchronized episodes and export to LeRobotDataset format in one line.',
  cta: 'See the datasets',
  ctaHref: '/datasets/',
};

/** Home — built for builders. */
export const BUILDERS = {
  kicker: 'Built for builders',
  title: 'Three doors. One module.',
  cards: [
    {
      title: 'Researchers',
      body: 'Multimodal ground truth without the plumbing. Citable, reproducible, BibTeX-ready.',
      href: '/research/',
    },
    {
      title: 'Robotics teams',
      body: 'A perception stack prototyped in an afternoon, not a quarter.',
      href: '/developers/',
    },
    {
      title: 'LeRobot community',
      body: 'The perception head for your SO-101 rig.',
      href: '/lerobot/',
    },
  ],
};

/** Home — dev kit band. */
export const DEVKIT_BAND = {
  kicker: 'Developer kit',
  title: 'EMB-01 Developer Kit — Batch One.',
  facts: ['[TODO: price]', '[TODO: batch size] units, hand-assembled in Tallinn', '[TODO: ship window]'],
  cta: 'Reserve yours',
  ctaHref: '/devkit/',
};

/** Full spec table (real values from the working proof of concept). */
export const SPEC_GROUPS: { group: string; rows: [string, string][] }[] = [
  {
    group: 'Ranging',
    rows: [
      ['2D LiDAR', 'FHL-LD19 · 360° · 12 m · 4,500 samples/s'],
      ['Near-field depth', '8×8 ToF ranging array · 64 zones · up to 4 m'],
    ],
  },
  {
    group: 'Motion',
    rows: [
      ['IMU', '10-axis · gyro + accel + magnetometer + barometer · 100 Hz'],
    ],
  },
  {
    group: 'Vision',
    rows: [
      ['Camera', 'AR0234 · 1/2.6″ global shutter · 1920×1200 @ 120 fps'],
    ],
  },
  {
    group: 'Audio',
    rows: [
      ['Microphones', '3 × directional · time-difference-of-arrival localization'],
      ['Encoding', 'Short-time Fourier transform → spectrogram region'],
    ],
  },
  {
    group: 'Compute',
    rows: [
      ['Module', 'NVIDIA Jetson Orin Nano Super 8 GB'],
      ['Performance', '67 TOPS (INT8) · 1024-core Ampere GPU'],
      ['Memory', '8 GB LPDDR5 · 102 GB/s'],
    ],
  },
  {
    group: 'Interface',
    rows: [
      ['Output', 'Single composed video frame · HDMI → USB-C capture'],
      ['Synchronization', 'On-device — all modalities share one frame clock · [TODO: sync precision]'],
      ['Host requirements', 'Anything that reads a standard camera stream'],
    ],
  },
  {
    group: 'Physical',
    rows: [
      ['Chassis', '3D-printed modular frame · sensor positions reconfigurable'],
      ['Weight', '[TODO: weight]'],
      ['Power', '[TODO: power draw]'],
    ],
  },
  {
    group: 'Status',
    rows: [
      ['Stage', 'Working proof of concept · specifications preliminary'],
    ],
  },
];

export const FOOTER_NOTE = `${PRODUCT_CODE} is a working proof of concept. Specifications preliminary.`;

/** Footer — links and the quiet OEM back door. */
export const FOOTER = {
  captureTitle: 'Batch One is small. Get in line.',
  links: [
    { label: 'Docs', href: '/developers/' },
    { label: 'GitHub', href: '', todo: '[TODO: link]' },
    { label: 'Discord', href: '', todo: '[TODO: link]' },
    { label: 'Build log', href: BUILD_LOG_URL },
    { label: 'Contact', href: CONTACT_MAILTO },
  ],
  modulesLine: 'Building a product on EMB-01? Talk to us about modules.',
};
