import { Ionicons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import {
    StatusBar,
    StyleSheet,
    Text,
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
import NewJobModal from "./src/features/results/NewJobModal";
import SettingsModal from "./src/features/settings/SettingsModal";
import { useJoinClientMutation } from "./src/hooks/useClient";
import { useArchiveJobMutation, useComputeMutation, useComputeStatusQuery } from "./src/hooks/useCompute";
import { useGridStatusQuery, useMarkDoneMutation } from "./src/hooks/useGrid";
import { ApiProvider, useApi } from "./src/providers/ApiProvider";

//Shoe location logic
type Action =
  | { type: "ROW_DOWN" }
  | { type: "ROW_UP" }
  | { type: "COLUMN_RIGHT" }
  | { type: "COLUMN_LEFT" }
  | { type: "SET_JUST_CAPTURED" }
  | { type: "RESET" };

type State = {
  row: number;
  column: number;
  justCaptured: boolean;
};

type Stage = "LANDING" | "CAPTURE_ONLY" | "CAPTURE_OR_DONE" | "WAITING" | "COMPUTE_READY";

function rowUpdateReducer(state: State, action: Action): State {
  switch (action.type) {
    case "ROW_DOWN":
      return {
        ...state,
        row: state.row + 1,
        // Only subtract 1 if the column was auto-incremented by a capture
        column: state.justCaptured ? Math.max(1, state.column - 1) : state.column,
        justCaptured: false,
      };
    case "ROW_UP":
      return { ...state, row: Math.max(1, state.row - 1), justCaptured: false };
    case "COLUMN_RIGHT":
      return { ...state, column: state.column + 1, justCaptured: false };
    case "COLUMN_LEFT":
      return { ...state, column: Math.max(1, state.column - 1), justCaptured: false };
    case "SET_JUST_CAPTURED":
      return { ...state, justCaptured: true };
    case "RESET":
      return { row: 1, column: 1, justCaptured: false };
    default:
      return state;
  }
}
const initialState: State = { row: 1, column: 1, justCaptured: false };

// ----- End of shoe location logic -----

function AppInner() {
  const { width } = useWindowDimensions();
  const isWide = width >= 520; // tweak threshold as you like

  const [gridId, setGridId] = useState<string>(DEFAULT_CLIENT_ID);
  const [stage, setStage] = useState<Stage>("LANDING");
  const [isLastClient, setIsLastClient] = useState(false);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);
  const [nextShoeLocationState, nextShoeLocationDispatch] = useReducer(
    rowUpdateReducer,
    initialState
  );
  const [goingRight, setGoingRight] = useState(true);
  const [showCompute, setShowCompute] = useState(false);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const joinClient = useJoinClientMutation();
  const archiveJob = useArchiveJobMutation();

  // Upload queue for async, order-preserving uploads
  const uploadQueue = useUploadQueue();
  const markDone = useMarkDoneMutation();
  const { zoomFactor, deviceId, baseUrl } = useApi();
  
  // Poll whenever not in LANDING so we can display active device count
  const statusQuery = useGridStatusQuery(gridId, deviceId, stage !== "LANDING");
  const computeMutation = useComputeMutation();
  // Poll compute status if we are waiting for another device to compute
  const computeStatusPoll = useComputeStatusQuery(stage === "COMPUTE_READY" && !isLastClient);

  useEffect(() => {
    if (stage === "WAITING" && statusQuery.data?.all_done) {
      setStage("COMPUTE_READY");
    }
  }, [stage, statusQuery.data?.all_done]);

  useEffect(() => {
    // If we're waiting for the last client to hit "Compute", automatically pop it open
    // once the backend sees inference starting (running === true).
    if (stage === "COMPUTE_READY" && !isLastClient && computeStatusPoll.data?.running) {
      setShowCompute(true);
    }
  }, [stage, isLastClient, computeStatusPoll.data?.running]);

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
    return `${gridId}-${nextShoeLocationState.row}-${nextShoeLocationState.column}`;
  }

  const onCapture = (uri: string) => {
    const locationInfo = getLocationInfo();
    if (goingRight) {
      updateNextShoeLocation("COLUMN_RIGHT");
    } else {
      updateNextShoeLocation("COLUMN_LEFT");
    }
    nextShoeLocationDispatch({ type: "SET_JUST_CAPTURED" });

    // Enqueue for background upload - returns immediately
    uploadQueue.enqueue(uri, locationInfo, gridId);

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
      // Pass the logically selected gridId and the globally unique deviceId
      const res = await markDone.mutateAsync({ grid: gridId, client_id: deviceId });
      uploadQueue.clearCompleted(); // Free memory
      setIsLastClient(res.is_last_client);
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

  const onConnect = async () => {
    try {
      await joinClient.mutateAsync({ grid: gridId, client_id: deviceId });
      setStage("CAPTURE_ONLY");
    } catch (e) {
      console.warn("Failed to join:", e);
    }
  };

  const handleNewJob = async (discard: boolean) => {
    const computeId = computeStatusPoll.data?.compute_id ?? null;
    if (computeId) {
      try {
        await archiveJob.mutateAsync({ compute_id: computeId, discard });
      } catch (e) {
        console.warn("Failed to archive job:", e);
      }
    }
    
    // Reset all internal states
    nextShoeLocationDispatch({ type: "RESET" });
    setGoingRight(true);
    setIsLastClient(false);
    setStage("LANDING");
    setShowCompute(false);
    setShowNewJobModal(false);
    // Note: Optionally we could clear the queue using uploadQueue.clearCompleted()
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
            height: 70
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowCompute(true)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: "rgba(96,165,250,0.15)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Load last compute results"
                  accessibilityRole="button"
                >
                  <Ionicons name="albums-outline" size={16} color="#60a5fa" />
                  <Text style={{ color: "#60a5fa", fontSize: 12, fontWeight: "600" }}>
                    Last Compute
                  </Text>
                </TouchableOpacity>
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
        </View>

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          gridId={gridId}
          onGridIdChange={setGridId}
        />

        {/* Body */}
        <View style={{ flex: 1, alignItems: "center" }}>
          {stage === "LANDING" ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%", padding: 32, gap: 24 }}>
                <Ionicons name="scan-circle" size={80} color="#60a5fa" />
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Ready to Connect</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 16 }}>Grid Name: {gridId}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 16 }}>Connect to: {baseUrl}</Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: "#5690d7ff", paddingVertical: 16, paddingHorizontal: 48, borderRadius: 30 }}
                  onPress={onConnect}
                  disabled={joinClient.isPending}
                >
                  <Text style={{ color: "#000", fontSize: 18, fontWeight: "700" }}>{joinClient.isPending ? "Connecting..." : "Connect"}</Text>
                </TouchableOpacity>
             </View>
          ) : (
            <View style={{ width: "100%", padding: 16, paddingTop: 8, gap: 12, flex: 1 }}>

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
              totalConnected={statusQuery.data?.total_clients ?? 1}
              isLastClient={isLastClient}
              locationOverlay={
                <>
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
                </>
              }
            />

            <ComputeModal
              visible={showCompute}
              onClose={() => setShowCompute(false)}
              clientId={deviceId}
              onStartNewJob={() => setShowNewJobModal(true)}
            />

            <NewJobModal
              visible={showNewJobModal}
              onClose={() => setShowNewJobModal(false)}
              onConfirm={handleNewJob}
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

          </View>
          )}
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
