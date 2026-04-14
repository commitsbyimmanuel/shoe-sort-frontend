// src/lib/crop.ts
import * as ImageManipulator from "expo-image-manipulator";

const TARGET_W = 768;
const TARGET_H = 1365;

// ═══════════════════════════════════════════════════════════════════
// TUNE THIS: Y-axis threshold for flipping inverted portrait images.
// When the camera HAL outputs portrait with EXIF 0 AND the phone's
// top edge is dipping (accel.y below this value), we assume the HAL
// produced an inverted portrait and flip 180°.
//
// Set very negative (e.g. -999) to disable portrait flipping entirely.
// Set to 0 to flip whenever the top edge dips at all.
// ═══════════════════════════════════════════════════════════════════
const PORTRAIT_FLIP_Y_THRESHOLD = -0.35;

/**
 * Normalizes an image to exactly TARGET_W × TARGET_H portrait.
 *
 * Rules:
 *  1. Landscape (w > h): rotate 90° or 270° based on accel.x
 *  2. Portrait  (h > w): flip 180° if accel.y < PORTRAIT_FLIP_Y_THRESHOLD
 *  3. Resize to TARGET_W, center-crop to TARGET_H
 */
export async function normalizeAndCropToAspect(
  uri: string,
  accel: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): Promise<string> {
  const probed = await ImageManipulator.manipulateAsync(uri, [], {});
  console.log(`[crop] probed: ${probed.width}×${probed.height}`);
  console.log(`accel.y value: ${accel.y}`);

  const actions: ImageManipulator.Action[] = [];

  if (probed.width > probed.height) {
    // Landscape → rotate to portrait using accel.x
    const rotation = accel.x < 0 ? 270 : 90;
    actions.push({ rotate: rotation });
    console.log(`[crop] rotating ${rotation}° to portrait (accel.x=${accel.x.toFixed(3)})`);
  } else if (accel.y < PORTRAIT_FLIP_Y_THRESHOLD) {
    // Portrait → possibly inverted, flip 180°
    actions.push({ rotate: 180 });
    console.log(`[crop] flipping 180° (accel.y=${accel.y.toFixed(3)} < threshold ${PORTRAIT_FLIP_Y_THRESHOLD})`);
  }

  // Resize to target width; height auto-scales
  actions.push({ resize: { width: TARGET_W } });

  const resized = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  console.log(`[crop] after resize: ${resized.width}×${resized.height}`);

  // Center-crop to exact target height if needed
  if (resized.height > TARGET_H) {
    const yOff = Math.floor((resized.height - TARGET_H) / 2);
    const cropped = await ImageManipulator.manipulateAsync(
      resized.uri,
      [{ crop: { originX: 0, originY: yOff, width: TARGET_W, height: TARGET_H } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log(`[crop] after center-crop: ${cropped.width}×${cropped.height}`);
    return cropped.uri;
  }

  return resized.uri;
}
