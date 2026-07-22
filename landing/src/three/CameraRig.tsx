import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { motion, screenAnchors } from '../lib/motion';
import { partRegistry } from './ModuleModel';

const worldPos = new THREE.Vector3();
const projected = new THREE.Vector3();

/**
 * Applies the GSAP-tweened proxy values to the real camera each frame and
 * projects part anchors to screen space for the DOM callout layer.
 * Scrub smoothing already lives in ScrollTrigger (scrub: 1); the only extra
 * smoothing layer here is pointer parallax damping.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const par = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    const tx = motion.pointer.x * motion.parallax;
    const ty = motion.pointer.y * motion.parallax * 0.6;
    par.current.x = THREE.MathUtils.damp(par.current.x, tx, 4, dt);
    par.current.y = THREE.MathUtils.damp(par.current.y, ty, 4, dt);
    // demand-frameloop: keep frames coming until the parallax damp settles
    if (Math.abs(par.current.x - tx) > 1e-4 || Math.abs(par.current.y - ty) > 1e-4) {
      state.invalidate();
    }

    // Parallax orbits laterally around the look target, never just strafes:
    // offset perpendicular to the view direction.
    const cx = motion.cam.x;
    const cy = motion.cam.y;
    const cz = motion.cam.z;
    const lx = motion.look.x;
    const ly = motion.look.y;
    const lz = motion.look.z;

    const dirX = lx - cx;
    const dirZ = lz - cz;
    const len = Math.hypot(dirX, dirZ) || 1;
    // right vector (perpendicular in xz-plane)
    const rx = -dirZ / len;
    const rz = dirX / len;

    camera.position.set(
      cx + rx * par.current.x * len * 0.25,
      cy + par.current.y * len * 0.18,
      cz + rz * par.current.x * len * 0.25,
    );
    // Safety orbit: no camera path may enter the module's bounding sphere.
    const MIN_R = 1.6;
    if (camera.position.lengthSq() < MIN_R * MIN_R) {
      camera.position.setLength(MIN_R);
    }
    camera.lookAt(lx, ly, lz);

    // Project live part anchor positions for DOM callouts.
    for (const [name, { obj, anchorLocal }] of partRegistry) {
      worldPos.copy(anchorLocal);
      obj.localToWorld(worldPos);
      projected.copy(worldPos).project(camera);
      let entry = screenAnchors[name];
      if (!entry) {
        entry = { x: 0, y: 0, visible: false };
        screenAnchors[name] = entry;
      }
      entry.x = (projected.x * 0.5 + 0.5) * size.width;
      entry.y = (-projected.y * 0.5 + 0.5) * size.height;
      entry.visible = projected.z < 1;
    }
  });

  return null;
}
