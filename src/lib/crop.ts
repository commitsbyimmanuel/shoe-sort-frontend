// src/lib/crop.ts
import * as ImageManipulator from "expo-image-manipulator";

const TARGET_W = 512;
const TARGET_H = 910;

/**
 * Normalizes an image to exactly TARGET_W × TARGET_H (512×910) portrait.
 *
 * 1. Safety-net: rotates 90° if the source is landscape (width > height).
 * 2. Resizes to width = 512 (height auto-scales, preserving aspect ratio).
 * 3. Center-crops to exactly 910px tall if the height overshoots.
 */
export async function normalizeAndCropToAspect(
  uri: string,
): Promise<string> {
  // Probe source dimensions (no-op manipulate just to read w/h)
  const probed = await ImageManipulator.manipulateAsync(uri, [], {});

  const actions: ImageManipulator.Action[] = [];

  // Safety: rotate landscape → portrait
  if (probed.width > probed.height) {
    actions.push({ rotate: 90 });
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
