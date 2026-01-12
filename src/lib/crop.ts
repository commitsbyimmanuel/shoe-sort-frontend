// src/lib/crop.ts
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Fast resize to target width, preserving aspect ratio.
 * Single-pass manipulation for optimal performance.
 * 
 * @param uri - Source image URI
 * @param _targetAspect - Unused, kept for API compatibility
 * @param targetSize - Target width in pixels (height auto-calculated to preserve aspect)
 */
export async function normalizeAndCropToAspect(
  uri: string,
  _targetAspect: number = 4 / 3,
  targetSize: number = 256
): Promise<string> {
  // Single pass: resize by width only, height auto-scales to preserve aspect ratio
  const final = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetSize } }],  // Only specify width → aspect preserved
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return final.uri;
}

