export const BRAND = 'EMBION';
export const PRODUCT_CODE = 'EMB-01';
export const PRODUCT_NAME = 'Multimodal Perception Module';
export const BUILD_LOG_URL =
  'https://medium.com/@aakhv110/from-discrete-sensors-to-unified-perception-building-a-plug-and-play-multimodal-module-054c197cb266';
export const CONTACT_MAILTO =
  'mailto:reza@ludaxis.io?subject=EMB-01%20early%20access';

export const HERO = {
  h1a: 'Every sense.',
  h1b: 'One stream.',
  sub: `${PRODUCT_CODE} fuses a 360° LiDAR, a 10-axis IMU, global-shutter vision, an 8×8 depth grid and three directional microphones on Jetson Orin Nano Super — and hands your robot one synchronized, AI-ready frame.`,
  ctaPrimary: 'Request early access',
  ctaSecondary: 'Read the build log',
};

export const STATS = [
  { value: '5', unit: '', label: 'sensing modalities' },
  { value: '67', unit: 'TOPS', label: 'on-device compute' },
  { value: '360', unit: '°', label: 'LiDAR field of view' },
  { value: '1', unit: '', label: 'synchronized stream out' },
];

export const PHILOSOPHY = {
  kicker: 'Why',
  line: 'Robots don’t need a perfect map of the world. They need a fast, meaningful understanding of what matters.',
  body: 'Each sensor alone gives a fragment: a distance, a frame, a pressure wave. EMB-01 starts from a different question — what does a machine need to understand in order to act? The answer is context: overlapping senses, fused into one lightweight, actionable state.',
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

export const CHAPTERS: Chapter[] = [
  {
    id: 'lidar',
    anchor: 'lidar-ld19',
    kicker: '01 · Range',
    title: 'Feel the shape of the room.',
    body: 'The FHL-LD19 sweeps a full 360° plane at 4,500 samples per second — cutting an invisible cross-section through walls, obstacles and moving people out to 12 meters.',
    specs: ['360° FOV', '12 m range', '4,500 samples/s'],
    side: 'left',
  },
  {
    id: 'imu',
    anchor: 'imu',
    kicker: '02 · Motion',
    title: 'An inner ear, at 100 Hz.',
    body: 'Proprioception for machines: the 10-axis IMU tracks orientation, acceleration and heading a hundred times a second, so every other reading lands in a stable frame of reference.',
    specs: ['10-axis', '100 Hz', 'gyro · accel · mag · baro'],
    side: 'right',
  },
  {
    id: 'mics',
    anchor: 'mic-b',
    kicker: '03 · Sound',
    title: 'Hearing beyond line of sight.',
    body: 'Three directional microphones triangulate what cameras can’t see — a voice behind the robot, a door around the corner — by time-difference-of-arrival.',
    specs: ['3 directional mics', 'TDOA localization', 'spectrogram encoding'],
    side: 'left',
  },
  {
    id: 'camera',
    anchor: 'camera-ar0234',
    kicker: '04 · Vision',
    title: 'A shutter that never smears.',
    body: 'The AR0234 captures 1920×1200 at up to 120 fps with a true global shutter — geometry-grade frames with zero rolling-shutter distortion, even at speed.',
    specs: ['1920 × 1200', '120 fps', 'global shutter'],
    side: 'right',
  },
  {
    id: 'tof',
    anchor: 'tof-8x8',
    kicker: '05 · Proximity',
    title: 'Sixty-four zones of near-field depth.',
    body: 'An 8×8 time-of-flight array paints a fast depth curtain over the forward blind spot — the whiskers that catch what the LiDAR plane misses.',
    specs: ['8 × 8 zones', '4 m reach', 'up to 60 Hz'],
    side: 'left',
  },
  {
    id: 'jetson',
    anchor: 'jetson',
    kicker: '06 · Compute',
    title: 'A brain on board.',
    body: 'A Jetson Orin Nano Super runs acquisition, fusion and encoding on-device: 67 TOPS of Ampere-class compute turning five raw streams into one coherent state.',
    specs: ['67 TOPS', '8 GB LPDDR5', 'JetPack 6'],
    side: 'right',
  },
  {
    id: 'fusion',
    anchor: 'chassis-upper',
    kicker: '07 · Fusion',
    title: 'Five senses. One frame.',
    body: 'Every modality is visually encoded and composed into a single synchronized video frame. To your host it’s just a camera — plug in USB-C, and any device can read the robot’s full sensory state.',
    specs: ['render-level sync', 'USB-C / HDMI out', 'reads as a standard camera'],
    side: 'left',
  },
];

export const INTERFACE_SECTION = {
  kicker: 'Interface',
  title: 'If it can read a camera, it can read EMB-01.',
  body: 'The composed frame travels over HDMI / USB-C as a standard video stream. Each region of the frame is one modality; parse the regions and you have the full state back — no custom drivers, no per-sensor pipelines.',
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
};

export const USE_CASES = [
  {
    title: 'Autonomous mobile robots',
    body: 'Path planning, obstacle avoidance and fast reaction in changing spaces — a richer picture than any single camera or range sensor.',
  },
  {
    title: 'Human–robot interaction',
    body: 'Is someone nearby? Approaching? Did they speak, and from where? Context-aware behavior around people, out of the box.',
  },
  {
    title: 'Multimodal datasets & AI training',
    body: 'Vision, depth, motion, sound and position captured from one physical scene, one timestamp — already composed as a visual input for training.',
  },
  {
    title: 'Research & teaching',
    body: 'One platform to see how five sensing modalities contribute to a single perception system — no driver zoo, no calibration marathon.',
  },
];

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
      ['Synchronization', 'Render-level — all modalities share one frame clock'],
      ['Host requirements', 'Anything that reads a standard camera stream'],
    ],
  },
  {
    group: 'Structure',
    rows: [
      ['Chassis', '3D-printed modular frame · sensor positions reconfigurable'],
      ['Status', 'Proof of concept · specifications preliminary'],
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does the module connect to my system?',
    a: 'Over HDMI into a USB-C capture card. The host sees a standard camera stream — any device that can read a webcam can read EMB-01, no custom drivers.',
  },
  {
    q: 'What exactly is in the output frame?',
    a: 'One composed image per tick: LiDAR planar scans, the 8×8 ToF grid, IMU orientation, GPS-style position (where fitted), the microphone spectrogram and the camera view — each in a fixed region you can parse back into raw values.',
  },
  {
    q: 'How are the sensors synchronized?',
    a: 'At the render level. Every modality is drawn into the same frame by the same clock on the Jetson, so a frame is a snapshot of the whole sensory state at one moment.',
  },
  {
    q: 'Can I use it with ROS 2?',
    a: 'The stream arrives as a standard camera topic; a parser node splits it into per-modality topics. A reference ROS 2 driver is part of the roadmap.',
  },
  {
    q: 'Can the sensor arrangement be customized?',
    a: 'The chassis is 3D-printed and modular by design — sensor positions, additions and the encoding layout are all reconfigurable.',
  },
  {
    q: 'What is the current status?',
    a: 'Working proof of concept, documented publicly in a seven-part build log. Specifications are preliminary and will evolve through validation.',
  },
];

export const FOOTER_NOTE = `${PRODUCT_CODE} is a working proof of concept. Specifications preliminary.`;
