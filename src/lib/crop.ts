// src/lib/crop.ts
import * as ImageManipulator from "expo-image-manipulator";

const TARGET_W = 768;
const TARGET_H = 1365;

// Counter-rotation to undo manipulateAsync's auto-EXIF rotation ONLY
// for the 180° false positive. EXIF 6 (90° CW) and 8 (270° CW) are
// normal sensor orientations that manipulateAsync correctly handles.
// EXIF 3 (180°) and EXIF 8 are always wrong when the screen is portrait-locked —
// it's caused by the ambiguous accelerometer when the phone is horizontal.
const COUNTER_ROTATIONS: Record<number, number> = {
  3: 180, // 180° false positive from horizontal phone
  8: 180,
};

/**
 * Normalizes an image to exactly TARGET_W × TARGET_H portrait.
 *
 * 1. Counter-rotates to undo any incorrect auto-EXIF rotation.
 * 2. Safety-net: rotates 90° if the source is landscape (width > height).
 * 3. Resizes to width = TARGET_W (height auto-scales).
 * 4. Center-crops to TARGET_H if height overshoots.
 */
export async function normalizeAndCropToAspect(
  uri: string,
  exifOrientation: number = 1,
): Promise<string> {
  const actions: ImageManipulator.Action[] = [];

  // Step 1: Counter-rotate to cancel manipulateAsync's auto-EXIF rotation
  const counterRotation = COUNTER_ROTATIONS[exifOrientation];
  if (counterRotation) {
    actions.push({ rotate: counterRotation });
    console.log(`[crop] counter-rotating ${counterRotation}° for EXIF orientation ${exifOrientation}`);
  }

  // Probe post-EXIF dimensions (no-op manipulate to read w/h after auto-rotation)
  const probed = await ImageManipulator.manipulateAsync(uri, [], {});

  // Step 2: Safety — rotate landscape → portrait
  if (probed.width > probed.height) {
    actions.push({ rotate: 90 });
  }

  // Step 3: Resize to target width; height auto-scales
  actions.push({ resize: { width: TARGET_W } });

  const resized = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  console.log(`[crop] after resize: ${resized.width}×${resized.height}`);

  // Step 4: Center-crop to exact target height if needed
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
