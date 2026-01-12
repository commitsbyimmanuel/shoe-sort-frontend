import { Ionicons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import {
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { DEFAULT_CLIENT_ID } from "./src/config";
import CameraCapture from "./src/features/camera/CameraCapture";
import { useUploadQueue } from "./src/hooks/useUploadQueue";
import { queryClient } from "./src/queryClient";
import type { ApiResponse } from "./src/types";

import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import LocationUpdater from "./src/features/location/LocationUpdater";
import LocationView from "./src/features/location/LocationView";
import ComputeModal from "./src/features/results/ComputeModal";
import SettingsModal from "./src/features/settings/SettingsModal";
import { useComputeMutation } from "./src/hooks/useCompute";
import { useGridStatusQuery, useMarkDoneMutation } from "./src/hooks/useGrid";
import { ApiProvider, useApi } from "./src/providers/ApiProvider";

//Shoe location logic
type Action =
  | { type: "ROW_DOWN" }
  | { type: "ROW_UP" }
  | { type: "COLUMN_RIGHT" }
  | { type: "COLUMN_LEFT" };

type State = {
  row: number;
  column: number;
};

type Stage = "CAPTURE_ONLY" | "CAPTURE_OR_DONE" | "WAITING" | "COMPUTE_READY";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ROW_DOWN":
      return { ...state, row: state.row + 1 };
    case "ROW_UP":
      return { ...state, row: Math.max(1, state.row - 1) }; // prevent going below 1
    case "COLUMN_RIGHT":
      return { ...state, column: state.column + 1 };
    case "COLUMN_LEFT":
      return { ...state, column: Math.max(1, state.column - 1) };
    default:
      return state;
  }
}
const initialState: State = { row: 1, column: 1 };

// ----- End of shoe location logic -----

function AppInner() {
  const { width } = useWindowDimensions();
  const isWide = width >= 520; // tweak threshold as you like

  const [clientId, setClientId] = useState<string>(DEFAULT_CLIENT_ID);
  const [stage, setStage] = useState<Stage>("CAPTURE_ONLY");
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);
  const [nextShoeLocationState, nextShoeLocationDispatch] = useReducer(
    reducer,
    initialState
  );
  const [goingRight, setGoingRight] = useState(true);
  const [showCompute, setShowCompute] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Upload queue for async, order-preserving uploads
  const uploadQueue = useUploadQueue();
  const markDone = useMarkDoneMutation();
  const statusQuery = useGridStatusQuery(clientId, stage === "WAITING");
  const computeMutation = useComputeMutation();
  const { zoomFactor } = useApi();

  useEffect(() => {
    if (stage === "WAITING" && statusQuery.data?.all_done) {
      setStage("COMPUTE_READY");
    }
  }, [stage, statusQuery.data?.all_done]);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const isError = lastResponse?.status === "error";

  const nextShoeLocation = `${nextShoeLocationState.row}-${nextShoeLocationState.column}`;
  function updateNextShoeLocation(
    direction: "ROW_DOWN" | "ROW_UP" | "COLUMN_RIGHT" | "COLUMN_LEFT"
  ) {
    nextShoeLocationDispatch({ type: direction });
  }

  function flipDirection() {
    setGoingRight((prev) => !prev);
  }

  function getLocationInfo(): string {
    return `${clientId}-${nextShoeLocationState.row}-${nextShoeLocationState.column}`;
  }

  const onCapture = (uri: string) => {
    const locationInfo = getLocationInfo();
    if (goingRight) {
      updateNextShoeLocation("COLUMN_RIGHT");
    } else {
      updateNextShoeLocation("COLUMN_LEFT");
    }

    // Enqueue for background upload - returns immediately
    uploadQueue.enqueue(uri, locationInfo, clientId);

    // After FIRST capture -> show Done + Capture
    if (stage === "CAPTURE_ONLY") setStage("CAPTURE_OR_DONE");
  };

  const onDone = async () => {
    // Wait for any pending uploads to complete before marking done
    if (uploadQueue.inFlight > 0) {
      console.log(`Waiting for ${uploadQueue.inFlight} uploads to complete...`);
      // Poll until queue is empty
      await new Promise<void>((resolve) => {
        const checkQueue = () => {
          if (uploadQueue.isAllDone()) {
            resolve();
          } else {
            setTimeout(checkQueue, 200);
          }
        };
        checkQueue();
      });
    }

    try {
      // Grid and Client are the SAME ID:
      await markDone.mutateAsync({ grid: clientId, client_id: clientId });
      uploadQueue.clearCompleted(); // Free memory
      setStage("WAITING"); // begin polling
    } catch (e) {
      console.warn("mark_done failed:", e);
      // keep user on CAPTURE_OR_DONE so they can retry Done
    }
  };

  const onCompute = async () => {
    try {
      await computeMutation.mutateAsync();
      setShowCompute(true);
    } catch (e) {
      console.warn("compute failed:", e);
    }
  };

  // Nice-to-have: show counts while waiting
  const waitingText =
    statusQuery.data && typeof statusQuery.data.total_clients === "number"
      ? `Waiting for others to be done (${statusQuery.data.done_clients.length}/${statusQuery.data.total_clients})`
      : "Waiting for others to be done";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <View
          style={{
            borderBottomColor: "#171717",
            borderBottomWidth: 1,
            backgroundColor: "rgba(10,10,10,0.8)",
          }}
        >
          <View
            style={{
              width: "100%",
              alignSelf: "center",
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                ShoeSort
              </Text>
              <TouchableOpacity
                onPress={() => setSettingsOpen(true)}
                style={{
                  padding: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Open settings"
                accessibilityRole="button"
              >
                <Ionicons name="settings-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {/* Body */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ width: "100%", padding: 16, gap: 12 }}>
            {/* Client ID Card */}
            <View
              style={{
                backgroundColor: "rgba(23,23,23,0.7)",
                borderColor: "#262626",
                borderWidth: 1,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <Text style={{ color: "#a3a3a3", fontSize: 12, marginBottom: 6 }}>
                Grid Name
              </Text>
              <TextInput
                value={clientId}
                onChangeText={setClientId}
                placeholder="person1"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                style={{
                  backgroundColor: "#171717",
                  borderColor: "#262626",
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: "#fff",
                  fontSize: 14,
                }}
              />
              <Text style={{ color: "#737373", fontSize: 11, marginTop: 8 }}>
                This ID is sent with each capture so other clients can receive
                your match.
              </Text>
            </View>

            {/* Camera */}
            <CameraCapture
              onCapture={onCapture}
              isError={isError}
              stage={stage}
              onDone={onDone}
              onCompute={onCompute}
              waitingText={waitingText}
              defaultZoomFactor={zoomFactor}
              queuePending={uploadQueue.pending}
              queueUploading={uploadQueue.uploading}
              queueFailed={uploadQueue.failed}
            />

            <ComputeModal
              visible={showCompute}
              onClose={() => setShowCompute(false)}
            />

            {uploadQueue.failed > 0 ? (
              <View style={cardStyle}>
                <View style={{ padding: 12 }}>
                  <Text style={{ color: "#f87171", fontSize: 14 }}>
                    {uploadQueue.failed} upload(s) failed.{" "}
                    <Text
                      style={{ textDecorationLine: "underline" }}
                      onPress={() => uploadQueue.retryFailed()}
                    >
                      Retry
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Results */}
            {/* <ResultsView data={lastResponse} /> */}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "stretch",
                height: 180,
              }}
            >
              <View style={{ flex: 1 }}>
                <LocationView
                  nextShoeLocation={nextShoeLocation}
                  goingRight={goingRight}
                  flipDirection={flipDirection}
                />
              </View>
              <View style={{ flex: 1 }}>
                <LocationUpdater
                  updateLocation={updateNextShoeLocation}
                  flipDirection={flipDirection}
                />
              </View>
            </View>

            {/* Footer */}
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <Text
                style={{
                  color: "#737373",
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                Built for SOEX Processing • Immanuel Varghese •
                immanuel@vargheselima.com
              </Text>
              <Text
                style={{
                  color: "#737373",
                  fontSize: 11,
                  textAlign: "center",
                }}
              ></Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const cardStyle = {
  backgroundColor: "rgba(23,23,23,0.7)",
  borderColor: "#262626",
  borderWidth: 1,
  borderRadius: 16,
  overflow: "hidden" as const,
};

const twoCol = StyleSheet.create({
  row: { alignItems: "stretch" },
  col: { flex: 1, minWidth: 0 }, // minWidth:0 prevents overflow in flex rows
});

const styles = StyleSheet.create({
  buttonPill: {
    backgroundColor: "#171717",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  buttonPillText: { color: "#d4d4d4", fontSize: 10 },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AppInner />
      </ApiProvider>
    </QueryClientProvider>
  );
}
