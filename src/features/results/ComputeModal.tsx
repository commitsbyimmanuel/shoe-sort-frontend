// src/components/ComputeModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useFeedbackMutation } from "../../hooks/useCompute";
import type { ComputeResponse, PairItem } from "../../types";

export default function ComputeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const compute = qc.getQueryData<ComputeResponse>(["compute.latest"]);
  const r0 = compute?.results?.[0];
  const [submittingPairId, setSubmittingPairId] = useState<string | null>(null);

  const pairs: PairItem[] = useMemo(() => r0?.pairs ?? [], [r0?.pairs]);
  const feedback = useFeedbackMutation();

  const handleFeedback = async (pairId: string, correct: boolean) => {
    if (!r0?.compute_id) return;
    try {
      setSubmittingPairId(pairId);
      await feedback.mutateAsync({
        compute_id: r0.compute_id,
        pair_id: pairId,
        correct,
      });
      // row removal happens in onSuccess (cache update)
    } finally {
      setSubmittingPairId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Compute Results</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Meta */}
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            Compute ID:{" "}
            <Text style={styles.metaMono}>{r0?.compute_id ?? "-"}</Text>
          </Text>
          <Text style={styles.metaText}>
            Grids: {r0?.grids?.join(", ") || "-"}
          </Text>
          <Text style={styles.metaText}>
            Pairs pending feedback: {pairs.length}
          </Text>
        </View>

        {/* List */}
        <ScrollView contentContainerStyle={styles.list}>
          {pairs.map((p) => (
            <View key={p.pair_id} style={styles.row}>
              <View style={styles.locCol}>
                <Text style={styles.loc}>{p.left.location}</Text>
              </View>
              <View style={styles.locCol}>
                <Text style={styles.loc}>{p.right.location}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.iconBtn,
                    submittingPairId === p.pair_id && styles.iconBtnDisabled,
                  ]}
                  disabled={submittingPairId === p.pair_id}
                  onPress={() => handleFeedback(p.pair_id, false)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={28}
                    color={
                      submittingPairId === p.pair_id ? "#9ca3af" : "#f87171"
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.iconBtn,
                    submittingPairId === p.pair_id && styles.iconBtnDisabled,
                  ]}
                  disabled={submittingPairId === p.pair_id}
                  onPress={() => handleFeedback(p.pair_id, true)}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={28}
                    color={
                      submittingPairId === p.pair_id ? "#9ca3af" : "#34d399"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {pairs.length === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-done-circle"
                size={36}
                color="#34d399"
              />
              <Text style={styles.emptyText}>All feedback submitted.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
  },
  header: {
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  closeBtn: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 8,
  },
  meta: { paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  metaText: { color: "#9ca3af", fontSize: 12 },
  metaMono: { color: "#e5e7eb", fontFamily: "System" },

  list: { padding: 12, gap: 8 },
  row: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#171717",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  locCol: { flex: 1, paddingRight: 8 },
  loc: { color: "#e5e7eb", fontSize: 13 },
  actions: { flexDirection: "row", gap: 12 },
  iconBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  iconBtnDisabled: { opacity: 0.6 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: { color: "#9ca3af", fontSize: 14 },
});
