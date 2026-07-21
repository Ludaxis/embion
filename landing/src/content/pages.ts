import { BUILD_LOG_URL, CONTACT_EMAIL } from './product';

/** Copy for the six sub-pages. Home copy lives in ./product.ts. */

export const DEVELOPERS = {
  kicker: 'Developers',
  h1: 'It’s a camera. Until you decode it.',
  sub: 'EMB-01 enumerates as a standard video device. Play the stream anywhere video plays. Decode it, and every modality lands in your code — synchronized.',
  // The SDK is not public yet; the API below is the working surface.
  codeTodo: '[TODO: confirm API]',
  code: `from embion import EMB01

sensor = EMB01()                 # enumerates like a camera
frame = sensor.read()            # one synchronized frame
print(frame.lidar, frame.imu)    # every modality, decoded
sensor.record("episode_001")     # LeRobot-format episode`,
  quickstart: {
    title: 'Quickstart',
    steps: [
      {
        title: 'Plug in.',
        body: 'One USB-C cable to any host — laptop, desktop, Jetson, Raspberry Pi.',
      },
      {
        title: 'See the stream.',
        body: 'Open any camera app. The composed frame is right there: five modalities in fixed regions.',
      },
      {
        title: 'Decode it.',
        body: 'Install the Python SDK [TODO: package name], read frames, get the full sensory state back as typed values.',
      },
    ],
  },
  ros: {
    title: 'ROS 2 driver',
    body: 'The stream arrives as a standard camera topic. A parser node splits it into per-modality topics — scan, IMU, image, range, audio. A reference driver is in development. [TODO: driver repo link]',
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
  community: {
    title: 'Community',
    body: 'Repo and community channels are on their way. Until then, the build log is the open window.',
    links: [
      { label: 'GitHub', todo: '[TODO: link]' },
      { label: 'Discord', todo: '[TODO: link]' },
    ],
  },
  isnt: {
    title: 'What it isn’t',
    items: [
      'Not IP-rated. The chassis is 3D-printed — treat it like the lab instrument it is.',
      'Not a certified safety sensor. Never put it in a safety loop.',
      'Not final hardware. EMB-01 is a working proof of concept; specifications are preliminary and will change.',
      '[TODO: environmental and electrical limits from final spec]',
    ],
  },
};

export const RESEARCH = {
  kicker: 'Research',
  h1: 'Synchronized multimodal ground truth, out of the box.',
  sub: 'Five modalities on one clock, exported to an open format. The capture rig disappears from your methods section.',
  themes: [
    {
      title: 'Per-modality timestamps',
      body: 'Every reading lands on the shared device clock at capture, so cross-modal alignment is a property of the recording — not a post-processing step. [TODO: timestamp resolution and sync spec]',
    },
    {
      title: 'Reproducible capture',
      body: 'Same sensors, same clock, same stream layout, so a capture protocol written for one EMB-01 runs on another. [TODO: cross-unit calibration details]',
    },
    {
      title: 'Dataset export',
      body: 'Episodes export to LeRobotDataset format — Parquet plus MP4 — ready for the Hugging Face Hub or your own pipeline.',
    },
  ],
  citation: {
    title: 'Cite the module',
    body: 'A citable hardware reference, so your methods section is one BibTeX entry instead of a paragraph of rig archaeology.',
    bibtex: `@misc{embion_emb01,
  title  = {EMB-01: [TODO: citation — full entry ships
            with the first hardware revision]},
}`,
  },
  foundingLabs: {
    kicker: 'Founding Labs Program',
    title: 'Five labs. Five units.',
    body: 'We support you directly; you break it and tell us how.',
    cta: 'Apply as a founding lab',
    subject: 'EMB-01 — founding lab application',
    note: `Applications by email. Tell us what you’d capture.`,
  },
};

export const LEROBOT = {
  kicker: 'LeRobot',
  h1: 'The perception head for your LeRobot rig.',
  body: 'Recording SO-101 episodes today means webcams taped to the desk — front, wrist, top — each on its own clock. EMB-01 replaces the camera rig and adds what webcams can’t: depth, geometry, sound, and motion, synchronized. One line exports episodes in LeRobotDataset format (Parquet + MP4), ready for the Hub.',
  mediaTodo: '[TODO: photo/render — EMB-01 mounted over an SO-101 workspace]',
  compat: {
    title: 'Compatibility',
    items: [
      'Any host that reads a camera reads EMB-01 — the same machine that runs your lerobot scripts.',
      'Designed to mount above or beside the workspace, replacing the front / wrist / top webcam rig. [TODO: SO-101 mount details]',
      'LeRobotDataset export (Parquet + MP4). [TODO: confirm supported format version]',
    ],
  },
  example: {
    title: 'Worked example',
    body: 'Record an episode, export it, visualize it, train on it — end to end. [TODO: example repo link]',
  },
};

export const DATASETS = {
  kicker: 'Datasets',
  h1: 'Don’t take our word for it. Take the data.',
  sub: 'The proof of a capture device is the data it captures.',
  comingSoon: {
    title: 'Coming soon.',
    body: 'No dataset is published yet, and we won’t fake one. When the first benchmark dataset is recorded, it lands here: downloadable, on the Hugging Face Hub, with an episode visualizer. [TODO: Hub link]',
    captureTitle: 'Be first to the data.',
    subject: 'EMB-01 datasets — notify me',
    cta: 'Notify me',
  },
};

export const DEVKIT = {
  kicker: 'Developer kit',
  h1: 'EMB-01 Developer Kit.',
  sub: 'Batch One: [TODO: batch size] units, hand-assembled in Tallinn. [TODO: ship window].',
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
  reserve: {
    title: 'Reserve yours.',
    body: 'Reserving takes an email, not a payment. We fill Batch One in order of the list.',
    subject: 'EMB-01 dev kit — Batch One reservation',
    cta: 'Reserve a dev kit',
  },
  oemLine: 'Volume or OEM module inquiries → talk to us.',
};

export const STORY = {
  kicker: 'Story',
  h1: 'Robots don’t have a body problem. They have a data problem.',
  paragraphs: [
    'Robots learn from data, and multimodal data is brutal to collect: a rig of webcams, a LiDAR with its own driver, an IMU on its own clock, and a weekend of alignment scripts. Every lab builds this rig. Every lab builds it differently. Every dataset it produces is a little bit wrong in its own way.',
    'EMB-01 replaces the rig. Five sensing modalities, hardware-synchronized on one device, delivered as a single stream any computer reads like a camera — and exported to LeRobot dataset format in one line.',
  ],
  proof: {
    title: 'A year of building, documented.',
    body: 'Designing, printing, assembling, programming — and then doing it again. Every step is documented in a public build log: the dead ends, the reprints, the working module.',
    cta: 'Read the build log',
    href: BUILD_LOG_URL,
  },
  founders: {
    title: 'Two people. Two halves.',
    body: 'One builds the hardware — the build log is Alireza’s, bracket by bracket. One builds the software and the product. [TODO: bios, photos]',
    place: 'Made in Tallinn, Estonia.',
  },
  closer: 'Modules first. Then the machines they make possible.',
  contactEmail: CONTACT_EMAIL,
};
