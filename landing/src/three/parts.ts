// Plain-data part geometry — no three/drei imports, so the DOM/scroll layer can
// read EXTRACT_VECTORS etc. without dragging the 3D bundle into the main chunk.

/** Part slugs present in the GLB (node names). v3 adds the hybrid model's
 *  mechanical detail (exposed PCB, ToF carrier, standoffs, 16 bolts) so every
 *  part participates in focus dimming. ('frame-detail' — the rough duplicate
 *  camera assembly — is intentionally absent: ModuleModel hides it.) */
export const PART_NAMES = [
  'mount-top',
  'chassis-upper',
  'chassis-lower',
  'housing-rear',
  'shell-rear',
  'jetson',
  'camera-ar0234',
  'tof-8x8',
  'lidar-ld19',
  'imu',
  'mic-a',
  'mic-b',
  'mic-c',
  'pcb-core',
  'mount-detail',
  'standoff-a',
  'standoff-b',
  'standoff-c',
  'standoff-d',
  ...Array.from({ length: 16 }, (_, i) => `bolt-${String(i + 1).padStart(2, '0')}`),
] as const;

/** Which parts light up together when a chapter focuses one anchor. */
export const FOCUS_GROUPS: Record<string, string[]> = {
  'lidar-ld19': ['lidar-ld19'],
  imu: ['imu'],
  'mic-b': ['mic-a', 'mic-b', 'mic-c'],
  'camera-ar0234': ['camera-ar0234'],
  'tof-8x8': ['tof-8x8', 'mount-detail'], // carrier plate lights with its board
  jetson: ['jetson', 'housing-rear', 'pcb-core'],
  'chassis-upper': [...PART_NAMES],
};

/** World-space exploded-view offsets (explode + part extraction). */
export const EXPLODE: Record<string, [number, number, number]> = {
  'lidar-ld19': [0, 0.55, 0],
  imu: [0, 0.95, 0],
  'mount-top': [0, 0.25, 0],
  'mic-a': [0.55, 0, 0],
  'mic-c': [-0.55, 0, 0],
  'mic-b': [0, 0, -0.5],
  'camera-ar0234': [0, 0, -0.65],
  'tof-8x8': [0, -0.25, -0.85],
  jetson: [0, 0, 0.75],
  'housing-rear': [0, 0, 0.4],
  'shell-rear': [0, 0, 1.2],
  'chassis-lower': [0, -0.15, 0],
};

/** Solo-extraction escape vectors. Defaults to EXPLODE, overridden where the
 *  exploded direction would drive a lone part through its neighbours:
 *  the LiDAR sits directly under the IMU plate (escape = forward), and the
 *  Jetson must travel far enough to fully clear the rear shell. */
export const EXTRACT_VECTORS: Record<string, [number, number, number]> = {
  ...EXPLODE,
  'lidar-ld19': [0, 0.1, -0.85],
  jetson: [0, 0, 0.95],
};
