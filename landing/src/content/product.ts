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
  { value: '6', unit: '', label: 'sensing modalities' },
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
    specs: ['360° · 12 m', '±45 mm accuracy', '4,500 samples/s'],
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
    body: 'Direction of sound, before line of sight. Three directional microphones place a voice behind your robot by time-difference-of-arrival — plus a dedicated low-noise acoustic channel for audio worth listening to.',
    specs: ['3 directional + 1 acoustic', 'TDOA localization', 'low-noise preamp · VGA'],
    side: 'left',
  },
  {
    id: 'camera',
    anchor: 'camera-ar0234',
    kicker: '04 · Vision',
    title: 'Sees at speed.',
    body: 'Sharp under motion, because robots move. A true global shutter captures 1920×1200 at up to 120 fps — no rolling-shutter smear, even at speed.',
    specs: ['1920 × 1200 @ 120 fps', 'global shutter', '100° DFOV · 87° HFOV'],
    side: 'right',
  },
  {
    id: 'tof',
    anchor: 'tof-8x8',
    kicker: '05 · Proximity',
    title: 'Reflexes.',
    body: 'Fast proximity, before vision has processed a frame. An 8×8 depth grid updates at up to 60 Hz across the near field the LiDAR plane misses.',
    specs: ['8 × 8 zones', '3.5 m reach', 'up to 60 Hz'],
    side: 'left',
  },
  {
    id: 'jetson',
    anchor: 'jetson',
    kicker: '06 · Compute',
    title: 'Fused before it leaves the device.',
    body: 'A Jetson Orin Nano Super runs acquisition, alignment, and encoding on board — 67 TOPS turning six raw feeds into one stream before your host reads a byte.',
    specs: ['67 TOPS', '8 GB LPDDR5', '15–25 W'],
    side: 'right',
  },
  {
    id: 'fusion',
    anchor: 'chassis-upper',
    kicker: '07 · One stream',
    title: 'Six senses. Complementary failure modes. One clock.',
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
      body: 'One USB-C cable. No driver zoo, no ROS dependency, no sensor plumbing.',
    },
    {
      title: 'It shows up as a camera.',
      body: 'Every modality, one synchronized stream, on any host that reads video.',
    },
    {
      title: 'Five lines of Python.',
      body: 'Decode, record, train. Export straight to LeRobot format.',
    },
  ],
};

/** Home — the hidden cost of getting started (research-kit argument). */
export const DAY_ONE = {
  kicker: 'Day one',
  title: 'Research starts in month six. It shouldn’t.',
  body: 'Before a team can test a single hypothesis, they lose 6–12 months to drivers, clocks, calibration, and data formats — problems that have nothing to do with the research question. EMB-01 ships that infrastructure as a finished instrument: pre-calibrated sensors, one common data format, modular by design.',
  without: {
    label: 'Without the kit',
    steps: [
      ['Weeks 1–2', 'Driver setup'],
      ['Weeks 3–4', 'Calibration'],
      ['Weeks 5–6', 'Data format'],
      ['Week 7+', 'Actual research'],
    ] as [string, string][],
  },
  withKit: {
    label: 'With EMB-01',
    steps: [['Day 1', 'Capturing real multimodal data']] as [string, string][],
  },
  solves: {
    title: 'Handled for you',
    items: [
      'Multi-sensor driver implementation',
      'Hardware timestamp alignment',
      'Intrinsic + extrinsic calibration',
      'Cross-modal synchronization',
      'Unified data format across modalities',
      'Edge-optimized inference pipeline',
      'Modular sensor extension framework',
      'Deterministic logging and replay',
    ],
  },
};

/** Home — modular extensibility (grows with your research). */
export const EXTEND = {
  kicker: 'Modular',
  title: 'Designed to grow with your research.',
  body: 'Modular at every level: add sensing capability, swap modalities, or integrate an entirely new sensor into the same clock and data format.',
  roster: [
    'GPS / GNSS',
    'Thermal camera',
    '3D LiDAR',
    'Gas / air sensors',
    'UWB / radar',
    'Force / tactile',
    'Physiological',
  ],
};

/** Home — why one stream. */
export const WHY_ONE_STREAM = {
  kicker: 'Sync',
  title: 'Sensors disagree about time. Robots can’t afford that.',
  body: 'Fusing modalities after the fact means aligning clocks, interpolating timestamps, and praying. EMB-01 synchronizes at the source — on the device — so what you record is what actually happened, in order.',
  todo: '[TODO: measured sync precision] across all five modalities.',
};

/** Home — the data story. */
export const DATA_STORY = {
  kicker: 'Data',
  title: 'Robots learn from demonstrations. Demonstrations are data.',
  body: 'Today, a multimodal recording rig is three webcams, a LiDAR with its own driver, and a weekend of alignment scripts. EMB-01 is the rig, in one head. Record synchronized episodes and export to LeRobotDataset format in one line.',
  cta: 'See the datasets',
  ctaHref: '/datasets/',
  microStat:
    'The entire open robot-learning corpus is ~1M episodes — pooled from 60+ labs. The field needs more instruments.',
  microStatFns: [6, 7],
};

/** Home — why now teaser (links to /story#why-now). */
export const WHY_NOW_TEASER = {
  line: 'Compute got cheap. Models got good. Data is the bottleneck — and it has to be recorded, not scraped.',
  cta: 'Why now',
  href: '/story/#why-now',
};

/** Numbered sources for every market stat on the site (rendered on /story#sources). */
export type Source = { n: number; label: string; url: string };
export const SOURCES: Source[] = [
  {
    n: 1,
    label: 'Goldman Sachs Research — the global market for robots could reach $38 billion by 2035',
    url: 'https://www.goldmansachs.com/insights/articles/the-global-market-for-robots-could-reach-38-billion-by-2035',
  },
  {
    n: 2,
    label: 'Morgan Stanley — humanoid robot market projected at $5 trillion by 2050',
    url: 'https://www.morganstanley.com/insights/articles/humanoid-robot-market-5-trillion-by-2050',
  },
  {
    n: 3,
    label: 'CNBC, June 2026 — Morgan Stanley doubles its China 2026 humanoid shipment forecast to 50,000',
    url: 'https://www.cnbc.com/2026/06/24/morgan-stanley-china-humanoid-robot-market-forecast.html',
  },
  {
    n: 4,
    label: 'BusinessWire, Jan 2026 — Skild AI raise at a $14B+ valuation, backed by SoftBank and NVIDIA’s venture arm',
    url: 'https://www.businesswire.com/news/home/20260114335623/en/',
  },
  {
    n: 5,
    label: 'The Elec, Mar 2026 — Physical Intelligence at an $11B valuation, pre-revenue',
    url: 'https://thelec.net/news/articleView.html?idxno=6214',
  },
  {
    n: 6,
    label: 'Shaip, June 2026 — robot training-data strategy: ~1M-episode open corpus; 5–50 episodes per operator-hour',
    url: 'https://www.shaip.com/blog/robot-training-data-strategy/',
  },
  {
    n: 7,
    label: 'arXiv 2508.10399 — embodied datasets vs web-scale corpora; 60+ labs pooling data',
    url: 'https://arxiv.org/pdf/2508.10399',
  },
  {
    n: 8,
    label: 'SVRC / AI Journal, 2026 — depth-camera street prices and host requirements',
    url: 'https://roboticscenter.ai/blog/best-depth-cameras-robotics',
  },
];

/** Demo video slot (Home + /developers). Drop the real file/URL into `src`
 *  when it exists — the player wires itself up; nothing else changes. */
export const DEMO_VIDEO = {
  kicker: 'Demo',
  title: 'Ninety seconds, plug to stream.',
  src: '', // e.g. '/media/demo-90s.mp4' — one-line change when the video lands
  poster: '/posters/home.v5.webp',
  caption: 'The 90-second demo ships with Batch One.',
  todo: '[TODO: 90-second demo video — plug in, webcam view, decoded view]',
};

/** Home — built for builders. */
export const BUILDERS = {
  kicker: 'Who it’s for',
  title: 'Built for builders.',
  cards: [
    {
      title: 'Model researchers',
      body: 'Fusion, multimodal models, and benchmarks on real-world data — without building the pipeline first.',
      href: '/research/',
    },
    {
      title: 'Robotics teams',
      body: 'Mount it as a complete multi-sensory perception brain: vision, depth, spatial, and audio.',
      href: '/developers/',
    },
    {
      title: 'Hardware researchers',
      body: 'Add custom sensors — GPS, thermal, 3D LiDAR — and study real-time scheduling on unified-memory SoC hardware.',
      href: '/research/',
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
  kicker: 'Developer Kit',
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
      ['2D LiDAR', 'FHL-LD19 · 360° · 12 m · ±45 mm · 4,500 samples/s'],
      ['Near-field depth', '8×8 ToF ranging array · 64 zones · up to 3.5 m @ 60 Hz'],
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
      ['Camera', 'AR0234 · 1/2.6″ global shutter · 1920×1200 @ 120 fps · 100° DFOV / 87° HFOV / 56° VFOV'],
    ],
  },
  {
    group: 'Audio',
    rows: [
      ['Microphones', '3 × directional (TDOA localization) + dedicated acoustic channel'],
      ['Analog front end', 'Low-noise preamp · variable-gain amplifier · output amplifier'],
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
      ['Synchronization', 'Render-level, on-device — all modalities share one frame clock · [TODO: sync precision]'],
      ['Host requirements', 'Anything that reads a standard camera stream'],
      ['Dependencies', 'No ROS required — plain video on any host · ROS 2 driver planned'],
    ],
  },
  {
    group: 'Physical',
    rows: [
      ['Chassis', '3D-printed modular frame · sensor positions reconfigurable'],
      ['Extensibility', 'Modular sensor framework — GPS/GNSS, thermal, 3D LiDAR, gas, UWB/radar, tactile, physiological'],
      ['Weight', '[TODO: weight]'],
      ['Power', '15–25 W envelope (Jetson Orin Nano Super)'],
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
