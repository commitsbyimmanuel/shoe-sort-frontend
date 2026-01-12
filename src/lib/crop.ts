// src/lib/crop.ts
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Fast center-crop to a target aspect and resize to model size.
 * Always outputs upright 256×256 JPEG.
 */
export async function normalizeAndCropToAspect(
  uri: string,
  targetAspect: number = 1, // width/height, default square
  targetSize: number = 256
): Promise<string> {
  // single-pass manipulation: crop + resize + compress
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [
      { rotate: 0 }, // bake in EXIF rotation
    ],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // get actual size after rotation normalization
  const W = manipResult.width!;
  const H = manipResult.height!;
  const current = W / H;

  let cropW = W;
  let cropH = H;

  if (current > targetAspect) cropW = Math.round(H * targetAspect);
  else if (current < targetAspect) cropH = Math.round(W / targetAspect);

  const originX = Math.max(0, Math.round((W - cropW) / 2));
  const originY = Math.max(0, Math.round((H - cropH) / 2));

  // second (final) step: crop + resize together
  const final = await ImageManipulator.manipulateAsync(
    manipResult.uri,
    [
      {
        crop: { originX, originY, width: cropW, height: cropH },
      },
      { resize: { width: targetSize, height: targetSize } },
    ],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return final.uri;
}
