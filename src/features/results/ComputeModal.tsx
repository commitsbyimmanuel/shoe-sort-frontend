// src/features/results/ComputeModal.tsx
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiUrl, IMAGES_PATH } from "../../config";
import {
  useComputeResultsQuery,
  useComputeStatusQuery,
  useFeedbackMutation,
} from "../../hooks/useCompute";
import type { PairItem } from "../../types";

type UndoItem = {
  pair_id: string;
  compute_id: string;
  previous_feedback: string | null;
};

export default function ComputeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  // Undo stack (local to this client)
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [submittingPairId, setSubmittingPairId] = useState<string | null>(null);

  // Poll status while modal is open and inference might be running
  const statusQuery = useComputeStatusQuery(visible);
  const isComputing = statusQuery.data?.running ?? false;
  const computeId = statusQuery.data?.compute_id ?? null;

  // Poll results for real-time sync (only when not computing)
  const resultsQuery = useComputeResultsQuery(computeId, visible && !isComputing);
  const results = resultsQuery.data;
  // Sort by descending similarity
  const pairs = useMemo(
    () => [...(results?.pairs ?? [])].sort((a, b) => b.sim - a.sim),
    [results?.pairs]
  );

  const feedback = useFeedbackMutation();

  const getImageUrl = (filename: string) => {
    // filename is like "GridA/GridA-1-1.jpg"
    // We need to construct: /images/GridA/GridA-1-1.jpg
    const parts = filename.split("/");
    if (parts.length >= 2) {
      const grid = parts[0];
      const file = parts[parts.length - 1];
      return `${apiUrl(IMAGES_PATH)}/${grid}/${file}`;
    }
    // Fallback: just use the filename as-is
    return `${apiUrl(IMAGES_PATH)}/${filename}`;
  };

  const handleFeedback = useCallback(
    async (pair: PairItem, correct: boolean) => {
      if (!computeId) return;
      try {
        setSubmittingPairId(pair.pair_id);
        const resp = await feedback.mutateAsync({
          compute_id: computeId,
          pair_id: pair.pair_id,
          correct,
        });
        // Push to undo stack
        setUndoStack((prev) => [
          ...prev,
          {
            pair_id: pair.pair_id,
            compute_id: computeId,
            previous_feedback: resp.previous_feedback,
          },
        ]);
      } finally {
        setSubmittingPairId(null);
      }
    },
    [computeId, feedback]
  );

  const handleUndo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    try {
      setSubmittingPairId(last.pair_id);
      await feedback.mutateAsync({
        compute_id: last.compute_id,
        pair_id: last.pair_id,
        correct: null, // null = clear feedback
      });
      setUndoStack((prev) => prev.slice(0, -1));
    } finally {
      setSubmittingPairId(null);
    }
  }, [undoStack, feedback]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Compute Results</Text>
          <View style={styles.headerActions}>
            {undoStack.length > 0 && (
              <TouchableOpacity
                onPress={handleUndo}
                style={styles.undoBtn}
                disabled={submittingPairId !== null}
              >
                <Ionicons name="arrow-undo" size={20} color="#60a5fa" />
                <Text style={styles.undoText}>Undo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Computing spinner */}
        {isComputing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Computing Results...</Text>
            <Text style={styles.loadingSubtext}>This may take a few minutes</Text>
          </View>
        ) : (
          <>
            {/* Meta */}
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                Pairs pending review:{" "}
                <Text style={styles.metaMono}>{pairs.length}</Text>
              </Text>
              {results?.min_sim && (
                <Text style={styles.metaText}>
                  Min similarity:{" "}
                  <Text style={styles.metaMono}>{results.min_sim.toFixed(3)}</Text>
                </Text>
              )}
            </View>

            {/* Pairs list */}
            <ScrollView contentContainerStyle={styles.list}>
              {pairs.map((p) => (
                <View key={p.pair_id} style={styles.pairCard}>
                  {/* Images row */}
                  <View style={styles.imagesRow}>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: getImageUrl(p.left.filename) }}
                        style={styles.shoeImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.locationLabel}>{p.left.location}</Text>
                    </View>
                    <View style={styles.simContainer}>
                      <Text style={styles.simScore}>{(p.sim * 100).toFixed(1)}%</Text>
                      <Text style={styles.simLabel}>similarity</Text>
                    </View>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: getImageUrl(p.right.filename) }}
                        style={styles.shoeImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.locationLabel}>{p.right.location}</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.falsePositiveBtn,
                        submittingPairId === p.pair_id && styles.btnDisabled,
                      ]}
                      disabled={submittingPairId === p.pair_id}
                      onPress={() => handleFeedback(p, false)}
                    >
                      <Ionicons name="close-circle" size={20} color="#f87171" />
                      <Text style={styles.falsePositiveText}>False Positive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.correctBtn,
                        submittingPairId === p.pair_id && styles.btnDisabled,
                      ]}
                      disabled={submittingPairId === p.pair_id}
                      onPress={() => handleFeedback(p, true)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#34d399" />
                      <Text style={styles.correctText}>Correct</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {pairs.length === 0 && !resultsQuery.isLoading && (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-done-circle" size={48} color="#34d399" />
                  <Text style={styles.emptyText}>All pairs reviewed!</Text>
                </View>
              )}
            </ScrollView>
          </>
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
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  undoText: { color: "#60a5fa", fontSize: 14, fontWeight: "600" },
  closeBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 8,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  loadingSubtext: { color: "#9ca3af", fontSize: 14 },

  meta: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  metaText: { color: "#9ca3af", fontSize: 13 },
  metaMono: { color: "#e5e7eb", fontWeight: "600" },

  list: { padding: 12, gap: 16 },

  pairCard: {
    backgroundColor: "#171717",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
  },
  imagesRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
  },
  shoeImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#262626",
  },
  locationLabel: {
    color: "#d4d4d4",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },
  simContainer: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  simScore: {
    color: "#fbbf24",
    fontSize: 18,
    fontWeight: "700",
  },
  simLabel: {
    color: "#737373",
    fontSize: 10,
  },

  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  falsePositiveBtn: {
    borderRightWidth: 1,
    borderRightColor: "#27272a",
  },
  correctBtn: {},
  falsePositiveText: { color: "#f87171", fontSize: 14, fontWeight: "600" },
  correctText: { color: "#34d399", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: "#9ca3af", fontSize: 16 },
});
