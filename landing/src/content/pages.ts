import { BUILD_LOG_URL, CONTACT_EMAIL } from './product';

/** Copy for the six sub-pages. Home copy lives in ./product.ts.
 *  Inline [TODO: …] markers render as visible chips; fns: [n] are footnote
 *  references into the numbered SOURCES list on /story#sources. */

export const DEVELOPERS = {
  kicker: 'Developers',
  h1: 'It’s a camera. Until you decode it.',
  sub: 'EMB-01 enumerates on any host as a standard video device. Point OpenCV at it and you have a demo. Import the SDK and you have five synchronized modalities with real timestamps.',
  codeTodo: '[TODO: confirm API]',
  // [TODO: confirm API names against shipped SDK]
  code: `from embion import EMB01

sensor = EMB01()                 # enumerates like a camera
frame = sensor.read()            # one synchronized frame
print(frame.lidar, frame.imu)    # every modality, decoded
sensor.record("episode_001")     # LeRobot-format episode`,
  quickstart: {
    kicker: 'Quickstart',
    title: 'Three commands, under five minutes.',
    steps: [
      {
        title: 'Plug in.',
        body: 'One USB-C cable to any host — laptop, desktop, Jetson, Raspberry Pi.',
      },
      {
        title: 'Webcam view.',
        body: 'Open any camera app. The composed frame is right there: five modalities in fixed regions.',
      },
      {
        title: 'Decoded view.',
        body: 'Import the SDK [TODO: package name]; the full sensory state comes back as typed values.',
      },
    ],
  },
  raw: {
    kicker: 'Raw access',
    title: 'Raw when you need it.',
    body: 'The camera trick is the on-ramp, not the ceiling. The SDK exposes raw, per-modality, timestamped data — [TODO: rates per modality] — for SLAM, VIO, and anything that hates interpolation.',
  },
  ros: {
    title: 'ROS 2',
    body: 'A native ROS 2 driver publishes each modality as standard topics with hardware timestamps. [TODO: repo link]',
  },
  sdk: {
    title: 'Python SDK',
    body: 'Read frames, decode modalities, record episodes, export LeRobotDataset. Not public yet. [TODO: GitHub link, release plan]',
  },
  format: {
    kicker: 'Stream format',
    title: 'One frame, five regions.',
    body: 'Each region of the composed frame is one modality, in a fixed layout. Parse the regions and you have the raw values back — no custom drivers, no per-sensor pipelines.',
    regions: [
      { id: 'camera', label: 'camera · 1920×1200 global shutter' },
      { id: 'lidar', label: 'lidar · 360° planar scan' },
      { id: 'tof', label: 'tof · 8×8 depth grid' },
      { id: 'imu', label: 'imu · orientation + accel' },
      { id: 'audio', label: 'audio · 3-mic spectrogram + DoA' },
    ],
    code: `# The whole module enumerates as one video device
import cv2
from embion import FrameParser

cap = cv2.VideoCapture(0)          # EMB-01 shows up as a camera
parser = FrameParser(layout="emb01-default")

while True:
    ok, frame = cap.read()         # one synchronized multimodal frame
    state = parser.parse(frame)
    state.lidar.points             # 360° planar scan (m, rad)
    state.imu.orientation          # roll / pitch / yaw @ 100 Hz
    state.tof.grid                 # 8x8 near-field depth (m)
    state.audio.spectrogram        # 3-mic STFT + direction of arrival
    state.camera.rgb               # 1920x1200 global-shutter frame`,
  },
  demoTodo: '[TODO: 90-second demo video — plug in, webcam view, decoded view]',
  community: {
    title: 'Community',
    body: 'Repo and community channels are on their way. Until then, the build log is the open window.',
    links: [
      { label: 'GitHub', todo: '[TODO: link]' },
      { label: 'Discord', todo: '[TODO: link]' },
      { label: 'Docs', todo: '[TODO: link]' },
    ],
  },
  isnt: {
    title: 'What it isn’t',
    body: 'EMB-01 is a development instrument. It is not IP-rated, not a certified safety sensor, and not a substitute for automotive-grade LiDAR. [TODO: complete from real spec]. We’d rather you know now.',
  },
};

export const RESEARCH = {
  kicker: 'Research',
  h1: 'Synchronized multimodal ground truth, out of the box.',
  intro:
    'Multimodal robot learning has a supply problem: the datasets are tiny because the instruments are improvised. The field’s largest open manipulation corpus — about a million episodes — took sixty-plus labs pooling their data. Language models train on trillions of tokens. The gap isn’t talent. It’s instrumentation.',
  introFns: [6, 7],
  methods: {
    title: 'Built for methods sections',
    body: 'Per-modality hardware timestamps [TODO: spec], identical capture across units, versioned firmware. Your setup paragraph writes itself — and replicates.',
  },
  corpus: {
    title: 'From capture to corpus',
    body: 'record() produces LeRobotDataset-format episodes (Parquet + MP4) ready for the Hugging Face Hub — the format the open embodied-AI community standardizes on.',
  },
  citation: {
    title: 'Cite it',
    body: 'A citable hardware reference, so your methods section is one BibTeX entry instead of a paragraph of rig archaeology.',
    bibtex: `@misc{embion_emb01,
  title  = {EMB-01: [TODO: citation entry — ships
            with the first hardware revision]},
}`,
  },
  foundingLabs: {
    kicker: 'Founding Labs Program',
    title: 'Five labs. Five units.',
    body: 'Direct support from both founders; you break it and tell us how. In exchange: honest feedback, a citation when it earns one, and permission to name you.',
    cta: 'Apply as a founding lab',
    subject: 'EMB-01 — founding lab application',
    note: 'Tell us what you’d capture.',
  },
};

export const LEROBOT = {
  kicker: 'LeRobot',
  h1: 'The perception head for your LeRobot rig.',
  body: 'Recording SO-101 episodes today means webcams taped to the desk — front, wrist, top — each on its own clock. EMB-01 replaces the camera rig and adds what webcams can’t: 360° geometry, sound, and motion, synchronized on-device. One line exports episodes in LeRobotDataset format, ready for the Hub.',
  mediaTodo: '[TODO: photo/render — EMB-01 mounted over an SO-101 workspace]',
  example: {
    title: 'Worked example',
    body: 'Teleoperate, record [TODO: n] episodes, train an imitation policy, compare against your webcam baseline. Full repo: [TODO: link]',
  },
  compat: {
    title: 'Compatibility',
    body: '[TODO: mounting, hosts tested, cable/power]',
  },
  community: {
    title: 'Show us your rig.',
    body: 'Building something on EMB-01 + LeRobot? We’ll feature it.',
    linkLabel: 'Discord',
    linkTodo: '[TODO: link]',
  },
};

export const DATASETS = {
  kicker: 'Datasets',
  h1: 'Don’t take our word for it. Take the data.',
  sub: 'The proof of a capture device is the data it captures.',
  comingSoon: {
    title: 'Coming soon.',
    body: 'No dataset is published yet, and we won’t fake one. Our first public benchmark dataset lands with Batch One — five modalities, one clock, on the Hugging Face Hub, with an episode visualizer. [TODO: Hub link]',
    captureTitle: 'Get notified.',
    subject: 'EMB-01 datasets — notify me',
    cta: 'Notify me',
  },
};

export const DEVKIT = {
  kicker: 'Developer Kit',
  h1: 'EMB-01 Developer Kit.',
  sub: 'Batch One. [TODO: batch size] units, hand-assembled in Tallinn, each one tested and supported by the people who designed it.',
  box: {
    title: 'What’s in the box',
    items: [
      'EMB-01 multimodal perception module',
      '[TODO: final kit contents — cables, mount, documentation]',
    ],
  },
  specsTitle: 'Full specifications',
  price: {
    label: 'Batch One price',
    value: '[TODO: price]',
  },
  compare: {
    kicker: 'Positioning',
    title: 'How it compares.',
    priceLabel: 'Street prices, July 2026',
    priceFns: [8],
    columns: ['RealSense D455', 'ZED 2i', 'OAK-D Pro', 'EMB-01'],
    rows: [
      { feature: 'Vision + depth', cells: ['✓', '✓', '✓', '✓'] },
      { feature: '360° LiDAR', cells: ['—', '—', '—', '✓'] },
      { feature: 'Microphone array', cells: ['—', '—', '—', '✓ (3, directional)'] },
      { feature: 'IMU', cells: ['✓', '✓', '✓', '✓ (10-axis)'] },
      { feature: 'Fast ToF proximity grid', cells: ['—', '—', '—', '✓ (8×8)'] },
      { feature: 'All modalities on one clock, at capture', cells: ['—', '—', '—', '✓ [TODO: spec]'] },
      { feature: 'On-device compute', cells: ['—', 'needs NVIDIA GPU host', 'on-device VPU', 'Jetson Orin Nano Super'] },
      { feature: 'LeRobot-native export', cells: ['—', '—', '—', '✓'] },
      { feature: 'Street price', cells: ['~$400', '~$500+', '~$400+', '[TODO: price]'] },
    ],
    caption:
      'Great instruments, all of them — we use some in our own lab. They see depth. EMB-01 records reality: geometry, sound, motion, and vision on one clock. Different job.',
  },
  reserve: {
    title: 'Reserve yours.',
    body: '[TODO: price] — reserve with your email. No payment today. Batch One ships [TODO: window]; reservations convert in order.',
    subject: 'EMB-01 dev kit — Batch One reservation',
    cta: 'Reserve a dev kit',
  },
  oemLine: 'Volume or OEM module inquiries → talk to us.',
};

export const STORY = {
  kicker: 'Story',
  h1: 'Robots don’t have a body problem. They have a data problem.',
  /** Opening arc. Optional fns render as footnote sups; optional link renders inline after the text. */
  body: [
    {
      text: 'Everyone is building the brain. Foundation-model companies for robots now raise billions before their first product ships. The bodies are coming too — shipment forecasts double mid-year. What’s missing is quieter: the instrument that records the physical world in a form those brains can learn from.',
      fns: [3, 4, 5],
    },
    {
      text: 'EMB-01 started as one engineer’s year of stubbornness — designing, printing, wiring, and programming a module that fuses five senses into one synchronized stream. The build is documented in public, mistakes included — ',
      link: { label: 'read the build log', href: BUILD_LOG_URL },
      after: '.',
    },
    {
      text: 'Then a second founder joined: ten years of shipping software that millions of people actually use. One of us builds the hardware. One of us builds the software and the product. Both of us believe the same sentence: the next leap in robotics is bottlenecked by data, and data has to be recorded, not scraped.',
    },
    {
      text: 'We build the sense organs and the memory. Made in Tallinn, Estonia.',
    },
  ],
  whyNow: {
    id: 'why-now',
    kicker: 'Why now',
    title: 'The bottleneck moved.',
    paragraphs: [
      { text: 'Compute got cheap. Models got good. What’s left is the part nobody scraped: reality.' },
      {
        text: 'A language model learns from trillions of tokens copied off the internet for free. A robot learns from synchronized sight, depth, sound, and motion recorded during real physical interaction — and that data doesn’t exist at internet scale. The largest open robot-learning dataset holds about a million episodes, pooled from more than sixty labs. The image-text datasets behind modern vision models hold billions.',
        fns: [6, 7],
      },
      {
        text: 'Billions of dollars are now betting on robot foundation models. Every one of those models is hungry for the same thing: synchronized multimodal recordings of the physical world.',
        fns: [4, 5],
      },
      { text: 'EMB-01 is the instrument that records it.' },
    ],
  },
  stats: {
    note: 'Market figures are projections by the cited institutions, not facts.',
    tiles: [
      { value: '$38B', label: 'projected humanoid robot market by 2035', src: 'Goldman Sachs Research', fn: 1 },
      { value: '$5T', label: 'projected humanoid market by 2050', src: 'Morgan Stanley', fn: 2 },
      { value: '$14B+', label: 'valuation of a robot-brain company backed by SoftBank and NVIDIA’s venture arm', src: 'Skild AI, Jan 2026', fn: 4 },
      { value: '5–50', label: 'episodes per operator-hour from teleoperated data collection', src: 'industry estimate', fn: 6 },
    ],
  },
  founders: {
    title: 'Two people. Two halves.',
    body: 'One builds the hardware — the build log is Alireza’s, bracket by bracket. One builds the software and the product. [TODO: two short bios + photos]',
  },
  closer: 'Modules first. Then the machines they make possible.',
  sourcesTitle: 'Sources',
  contactEmail: CONTACT_EMAIL,
};
