// src/features/results/ComputeModal.tsx
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiUrl, IMAGES_PATH } from "../../config";
import { useWsComputeStatus } from "../../hooks/useCompute";
import {
  useGetPairQuery,
  useGradePairMutation,
  useWsGradingProgress,
} from "../../hooks/usePairGrading";
import type { GradeValue, GradingPair } from "../../types";

export default function ComputeModal({
  visible,
  onClose,
  clientId,
  onStartNewJob,
}: {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  onStartNewJob?: () => void;
}) {
  const [isGrading, setIsGrading] = useState(false);

  // Subscribe to real-time compute status via WebSocket (replaces 5 s polling)
  const statusQuery = useWsComputeStatus();
  const isComputing = statusQuery.data?.running ?? false;
  const computeId = statusQuery.data?.compute_id ?? null;

  // Fetch the next pair (only when not computing and we have a compute_id)
  const pairQuery = useGetPairQuery(computeId, clientId, visible && !isComputing);
  const currentPair = pairQuery.data?.pair ?? null;
  const progress = pairQuery.data?.progress ?? null;

  const gradeMutation = useGradePairMutation();

  const getImageUrl = (filename: string) => {
    // filename is like "GridA/GridA-01-01_abc.jpg"
    // Direct path: /images/GridA/GridA-01-01_abc.jpg
    const cacheBuster = Date.now();
    return `${apiUrl(IMAGES_PATH)}/${filename}?v=${cacheBuster}`;
  };

  const handleGrade = useCallback(
    async (pair: GradingPair, grade: GradeValue) => {
      if (!computeId || isGrading) return;
      try {
        setIsGrading(true);
        await gradeMutation.mutateAsync({
          compute_id: computeId,
          pair_id: pair.pair_id,
          client_id: clientId,
          grade,
        });
      } catch (e) {
        console.warn("Grade pair failed:", e);
      } finally {
        setIsGrading(false);
      }
    },
    [computeId, clientId, isGrading, gradeMutation]
  );

  // Determine the state
  const isLoading = pairQuery.isLoading || pairQuery.isFetching;
  const noPairForClient = !isComputing && !isLoading && currentPair === null && pairQuery.data != null;
  const othersStillGrading = noPairForClient && progress != null && (progress.pending + progress.locked) > 0;
  const allDone = noPairForClient && !othersStillGrading;

  // When another device grades a pair the server pushes grading_progress;
  // refetch our pair query so the progress counter updates instantly.
  useWsGradingProgress(
    computeId,
    () => {
      if (othersStillGrading) {
        pairQuery.refetch();
      }
    },
    visible && !isComputing
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pair Grading</Text>
          <View style={styles.headerActions}>
            {progress && (
              <View style={styles.progressBadge}>
                <Text style={styles.progressText}>
                  {progress.graded} / {progress.total}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Computing spinner */}
        {isComputing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.centerTitle}>Computing Results...</Text>
            <Text style={styles.centerSubtext}>This may take a few minutes</Text>
          </View>
        ) : othersStillGrading ? (
          /* This client has no more pairs, but others are still working */
          <View style={styles.centerContainer}>
            <View style={styles.doneIconCircle}>
              <Ionicons name="hourglass-outline" size={56} color="#60a5fa" />
            </View>
            <Text style={styles.centerTitle}>Your Pairs Are Done</Text>
            <Text style={styles.centerSubtext}>
              Waiting for other devices to finish grading ({progress!.graded} / {progress!.total} graded)
            </Text>
            <ActivityIndicator size="small" color="#525252" style={{ marginTop: 8 }} />
          </View>
        ) : allDone ? (
          /* All pairs done */
          <View style={styles.centerContainer}>
            <View style={styles.doneIconCircle}>
              <Ionicons name="checkmark-done-circle" size={72} color="#34d399" />
            </View>
            <Text style={styles.centerTitle}>All Pairs Graded</Text>
            <Text style={styles.centerSubtext}>
              All {progress?.total ?? 0} pairs have been graded
            </Text>
            {onStartNewJob && (
              <TouchableOpacity
                style={{
                  marginTop: 24,
                  backgroundColor: "#262626",
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderColor: "#404040",
                  borderWidth: 1,
                }}
                onPress={onStartNewJob}
              >
                <Ionicons name="refresh-circle" size={24} color="#60a5fa" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Start New Job</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isLoading && !currentPair ? (
          /* Loading next pair */
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.centerSubtext}>Loading pair...</Text>
          </View>
        ) : currentPair ? (
          /* Show the current pair for grading */
          <View style={styles.pairContainer}>
            {/* Progress bar */}
            {progress && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progress.total > 0
                          ? (progress.graded / progress.total) * 100
                          : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressBarLabel}>
                  {progress.graded} graded · {progress.pending} pending
                </Text>
              </View>
            )}

            {/* Pair card */}
            <View style={styles.pairCard}>
              {/* Similarity score */}
              <View style={styles.simBadgeRow}>
                <View style={styles.simBadge}>
                  <Text style={styles.simScore}>
                    {(currentPair.sim * 100).toFixed(1)}%
                  </Text>
                  <Text style={styles.simLabel}>similarity</Text>
                </View>
              </View>

              {/* Images row */}
              <View style={styles.imagesRow}>
                {/* Left shoe */}
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: getImageUrl(currentPair.left.filename), cache: "reload" }}
                    style={styles.shoeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.locationBadge}>
                    <Ionicons name="location" size={14} color="#fbbf24" />
                    <Text style={styles.locationText}>
                      {currentPair.left.location.split('-').slice(1).join('-')}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                  <Ionicons name="swap-horizontal" size={24} color="#525252" />
                </View>

                {/* Right shoe */}
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: getImageUrl(currentPair.right.filename), cache: "reload" }}
                    style={styles.shoeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.locationBadge}>
                    <Ionicons name="location" size={14} color="#fbbf24" />
                    <Text style={styles.locationText}>
                      {currentPair.right.location.split('-').slice(1).join('-')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Grading buttons */}
            <View style={styles.gradeButtonsRow}>
              <TouchableOpacity
                style={[styles.gradeBtn, styles.wrongBtn, isGrading && styles.btnDisabled]}
                disabled={isGrading}
                onPress={() => handleGrade(currentPair, "incorrect")}
              >
                <Ionicons name="close-circle" size={28} color="#fff" />
                <Text style={styles.gradeBtnText}>Wrong</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gradeBtn, styles.skipBtn, isGrading && styles.btnDisabled]}
                disabled={isGrading}
                onPress={() => handleGrade(currentPair, "skip")}
              >
                <Ionicons name="help-circle" size={28} color="#fff" />
                <Text style={styles.gradeBtnText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gradeBtn, styles.foundBtn, isGrading && styles.btnDisabled]}
                disabled={isGrading}
                onPress={() => handleGrade(currentPair, "correct")}
              >
                <Ionicons name="checkmark-circle" size={28} color="#fff" />
                <Text style={styles.gradeBtnText}>Found</Text>
              </TouchableOpacity>
            </View>

            {isGrading && (
              <View style={styles.gradingOverlay}>
                <ActivityIndicator size="small" color="#60a5fa" />
              </View>
            )}
          </View>
        ) : (
          /* No compute data at all */
          <View style={styles.centerContainer}>
            <Ionicons name="analytics-outline" size={48} color="#525252" />
            <Text style={styles.centerTitle}>No Compute Results</Text>
            <Text style={styles.centerSubtext}>
              Run compute first to generate pairs
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressBadge: {
    backgroundColor: "rgba(96,165,250,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  closeBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 8,
  },

  // Center states (computing, done, loading, no data)
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  centerTitle: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  centerSubtext: { color: "#9ca3af", fontSize: 14, textAlign: "center" },
  doneIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(52,211,153,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Pair grading view
  pairContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    gap: 16,
  },

  // Progress bar
  progressBarContainer: {
    gap: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#262626",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#34d399",
  },
  progressBarLabel: {
    color: "#737373",
    fontSize: 12,
    textAlign: "center",
  },

  // Pair card
  pairCard: {
    backgroundColor: "#171717",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
    padding: 16,
    gap: 12,
  },
  simBadgeRow: {
    alignItems: "center",
  },
  simBadge: {
    backgroundColor: "rgba(251,191,36,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  simScore: {
    color: "#fbbf24",
    fontSize: 18,
    fontWeight: "700",
  },
  simLabel: {
    color: "#a3894a",
    fontSize: 12,
  },

  imagesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  shoeImage: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 14,
    backgroundColor: "#262626",
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251,191,36,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  locationText: {
    color: "#fbbf24",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
  divider: {
    paddingHorizontal: 4,
  },

  // Grade buttons
  gradeButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  gradeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  wrongBtn: {
    backgroundColor: "#991b1b",
  },
  skipBtn: {
    backgroundColor: "#1e40af",
  },
  foundBtn: {
    backgroundColor: "#166534",
  },
  gradeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  gradingOverlay: {
    alignItems: "center",
    paddingTop: 4,
  },
});
