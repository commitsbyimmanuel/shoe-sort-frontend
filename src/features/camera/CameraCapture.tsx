// CameraCapture.tsx
import { CameraView } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Accelerometer } from "expo-sensors";

import { GestureHandlerRootView, PinchGestureHandler, PinchGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { normalizeAndCropToAspect } from "../../lib/crop";

type Stage = "CAPTURE_ONLY" | "CAPTURE_OR_DONE" | "WAITING" | "COMPUTE_READY";

type CameraCaptureProps = {
  onCapture: (uri: string) => void | Promise<void>;
  isError?: boolean;
  stage?: Stage;
  onDone?: () => void | Promise<void>;
  onCompute?: () => void | Promise<void>;
  onShowLastCompute?: () => void;
  hasComputed?: boolean;
  waitingText?: string;
  defaultZoomFactor?: number;
  // Queue status for display
  queuePending?: number;
  queueUploading?: number;
  queueFailed?: number;
  // Location overlay - rendered transparently on the camera
  locationOverlay?: React.ReactNode;
  
  totalConnected?: number;
  isLastClient?: boolean;
};


const PREVIEW_ASPECT = 9 / 16;

export default function CameraCapture({
  onCapture,
  isError = false,
  stage = "CAPTURE_ONLY",
  onDone,
  onCompute,
  onShowLastCompute,
  hasComputed = false,
  waitingText = "Waiting for others to be done",
  defaultZoomFactor = 1.4,
  queuePending = 0,
  queueUploading = 0,
  queueFailed = 0,
  locationOverlay,
  totalConnected = 1,
  isLastClient = false,
}: CameraCaptureProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [lastShotUri, setLastShotUri] = useState<string | null>(null);

  // Approximate map: 1x => 0, 2x => 0.5, 3x => 0.75, 5x => 1
  const toExpoZoom = (factor: number) => {
    const clamped = Math.max(1, Math.min(factor, 5));
    if (clamped <= 1) return 0;
    if (clamped >= 5) return 1;
    return (clamped - 1) / 4;
  };
  const [zoom, setZoom] = useState<number>(0);
  const baseZoomRef = useRef<number>(0);

  const accelRef = useRef({ x: 0, y: 0, z: 0 });
  const [accelDisplay, setAccelDisplay] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener((data) => {
      accelRef.current = data;
      setAccelDisplay(data);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready) {
      // Delay slightly to ensure some Android devices (like Nothing phone)
      // successfully process the initial zoom update after setting up the native camera.
      const timer = setTimeout(() => {
        const newZoom = toExpoZoom(defaultZoomFactor);
        setZoom(newZoom);
        baseZoomRef.current = newZoom;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [defaultZoomFactor, ready]);

  // Pinch-to-zoom handler
  const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    const scale = event.nativeEvent.scale;
    // Calculate new zoom based on base zoom and pinch scale
    const newZoom = Math.max(0, Math.min(1, baseZoomRef.current * scale));
    setZoom(newZoom);
  };

  const onPinchHandlerStateChange = (event: PinchGestureHandlerGestureEvent) => {
    // When gesture ends, save the current zoom as the new base
    if (event.nativeEvent.state === 5) { // State.END = 5
      baseZoomRef.current = zoom;
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || sending) return;
    setErr(null);
    setSending(true);
    try {
      const t0 = Date.now();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: true,
      });
      console.log("t_capture", Date.now() - t0);

      if (!photo?.uri) throw new Error("Camera not ready");

      const t1 = Date.now();
      const accel = { ...accelRef.current };
      console.log(
        `[capture] photo: ${photo.width}×${photo.height}` +
        `, EXIF=${photo.exif?.Orientation ?? '?'}` +
        `, accel=(${accel.x.toFixed(2)}, ${accel.y.toFixed(2)}, ${accel.z.toFixed(2)})`
      );
      const croppedUri = await normalizeAndCropToAspect(
        photo.uri,
        accel,
      );
      console.log("t_crop", Date.now() - t1);

      setLastShotUri(croppedUri);

      // Fire-and-forget: enqueue for background upload, don't await
      // This makes capture near-instant (~350ms instead of ~1550ms)
      onCapture(croppedUri);
      console.log("t_ready_for_next", Date.now() - t0);
    } catch (e: any) {
      setErr(e?.message || "Capture failed");
    } finally {
      setSending(false);
    }
  };

  // Render bottom action button based on stage
  const renderBottomAction = () => {
    if (stage === "CAPTURE_ONLY") {
      // Done disabled until first capture
      return (
        <TouchableOpacity
          style={[styles.button, styles.buttonSingle, styles.buttonDisabled]}
          disabled
        >
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      );
    }

    if (stage === "CAPTURE_OR_DONE") {
      return (
        <TouchableOpacity
          style={[styles.button, styles.buttonSingle]}
          onPress={() => onDone?.()}
          disabled={sending}
        >
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      );
    }

    if (stage === "WAITING") {
      return (
        <TouchableOpacity
          style={[styles.button, styles.buttonSingle, styles.buttonDisabled]}
          disabled
        >
          <Text style={styles.buttonText}>{waitingText}</Text>
        </TouchableOpacity>
      );
    }

    // COMPUTE_READY
    if (!isLastClient) {
      return (
        <TouchableOpacity
          style={[styles.button, styles.buttonSingle, styles.buttonDisabled]}
          disabled
        >
          <Text style={styles.buttonText}>Waiting for other device to compute...</Text>
        </TouchableOpacity>
      );
    }

    if (hasComputed) {
      return (
        <TouchableOpacity
          style={[styles.button, styles.buttonSingle, { backgroundColor: "#1e40af" }]}
          onPress={() => onShowLastCompute?.()}
        >
          <Text style={styles.buttonText}>Show Last Compute</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.button, styles.buttonSingle, { backgroundColor: "#15803d" }]}
        onPress={() => onCompute?.()}
      >
        <Text style={styles.buttonText}>Compute</Text>
      </TouchableOpacity>
    );
  };

  // Build status text showing queue state
  const getStatusText = () => {
    if (!ready) return "Starting camera…";
    const parts: string[] = [];
    if (queueUploading > 0) parts.push(`${queueUploading} uploading`);
    if (queuePending > 0) parts.push(`${queuePending} pending`);
    if (queueFailed > 0) parts.push(`${queueFailed} failed`);
    if (parts.length > 0) return parts.join(" • ");
    return `${totalConnected} device${totalConnected !== 1 ? "s" : ""} connected`;
  };

  return (
    <View style={styles.card}>
      <GestureHandlerRootView style={styles.previewBox}>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <View style={{ flex: 1 }}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setReady(true)}
              animateShutter={false}
              zoom={zoom}
              ratio="16:9"
              responsiveOrientationWhenOrientationLocked={false}
            />

            {lastShotUri ? (
              <Image source={{ uri: lastShotUri }} style={styles.thumb} />
            ) : null}

            {/* Debug: live accelerometer overlay */}
            <View style={styles.accelOverlay}>
              <Text style={styles.accelText}>x: {accelDisplay.x.toFixed(3)}</Text>
              <Text style={styles.accelText}>y: {accelDisplay.y.toFixed(3)}</Text>
              <Text style={styles.accelText}>z: {accelDisplay.z.toFixed(3)}</Text>
            </View>

            {sending && (
              <View style={styles.spinnerOverlay}>
                <ActivityIndicator size="large" />
                <Text style={styles.spinnerText}>Sending image…</Text>
              </View>
            )}

            {/* Header overlay - transparent at bottom above location */}
            <View style={styles.headerOverlay}>
              <Text style={styles.title}>Live Camera</Text>
              <Text style={[styles.label, queueFailed > 0 && styles.labelError]}>
                {getStatusText()}
              </Text>
            </View>

            {/* Location overlay - below header */}
            {locationOverlay && (
              <View style={styles.locationOverlay}>
                {locationOverlay}
              </View>
            )}

            {/* Circular capture button overlay */}
            <View style={styles.captureButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  (sending || !ready) && styles.buttonDisabled,
                ]}
                onPress={handleCapture}
                disabled={sending || !ready}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </PinchGestureHandler>
      </GestureHandlerRootView>

      <View style={styles.body}>
        {!!err && <Text style={styles.error}>{err}</Text>}
        {renderBottomAction()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "rgba(23,23,23,0.7)",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  headerOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  title: { color: "#fafafa", fontWeight: "600", fontSize: 14 },
  label: { color: "#a3a3a3", fontSize: 11 },
  labelError: { color: "#f87171" },
  envText: { color: "#d4d4d4", fontSize: 10 },

  previewBox: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  thumb: {
    position: "absolute",
    left: 10,
    bottom: 12,
    width: 96,
    height: 160,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#404040",
  },
  accelOverlay: {
    position: "absolute",
    right: 8,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  accelText: {
    color: "#0f0",
    fontSize: 12,
    fontFamily: "monospace",
  },

  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerText: { color: "#e5e5e5", marginTop: 8, fontSize: 14 },

  locationOverlay: {
    position: "absolute",
    top: 45,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 10,
    opacity: 0.75,
    height: 130
  },

  // Circular capture button overlay
  captureButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fff",
  },

  body: { padding: 8 },

  // Buttons
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  rowLeft: {
    marginRight: 10, // RN-safe spacing (avoid `gap` for wider compatibility)
  },
  button: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: "#171717",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
    textAlignVertical: "center",
  },
  buttonSingle: {
    width: "100%",
  },
  error: { color: "#f87171", fontSize: 14 },
  grow: {
    flex: 1,
    alignSelf: "auto",
  },
});
