import * as THREE from "three";

/**
 * Half-gap between targetA and targetB along the fork's local Y.
 * The roast mount sets wing.rotation.x = +π/2, which maps wing local +Z onto fork local −Y.
 * Tine offsets are stored on fork local Y, so this span is the resting half-spacing
 * (one tine per bone). Fork translation and rotation cancel out via the inverse world matrix.
 */
export function forkLocalBoneHalfSpan(fork: THREE.Object3D, wing: THREE.Object3D): number {
  const tA = wing.getObjectByName("targetA");
  const tB = wing.getObjectByName("targetB");
  if (!tA || !tB) return 0.05;
  wing.updateWorldMatrix(true, true);
  const a = tA.getWorldPosition(new THREE.Vector3());
  const b = tB.getWorldPosition(new THREE.Vector3());
  const inv = new THREE.Matrix4().copy(fork.matrixWorld).invert();
  a.applyMatrix4(inv);
  b.applyMatrix4(inv);
  const half = Math.abs(a.y - b.y) * 0.5;
  if (!Number.isFinite(half) || half < 0.008) return 0.05;
  return half;
}
