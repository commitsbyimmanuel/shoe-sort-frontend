// src/features/results/NewJobModal.tsx
import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (discard: boolean) => void;
};

export default function NewJobModal({ visible, onClose, onConfirm }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="refresh-circle" size={64} color="#60a5fa" />
          </View>
          <Text style={styles.title}>Start New Job</Text>
          <Text style={styles.subtitle}>
            You have finished grading! How would you like to handle the current batch of shoes before starting a new job?
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.discardBtn]}
              onPress={() => onConfirm(true)}
            >
              <Text style={styles.buttonText}>❌ Discard shoes and Start New</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.keepBtn]}
              onPress={() => onConfirm(false)}
            >
              <Text style={styles.buttonText}>📸 Keep shoes and Start New</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#171717",
    borderRadius: 24,
    padding: 24,
    paddingTop: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderColor: "#262626",
    borderWidth: 1,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  discardBtn: {
    backgroundColor: "#7f1d1d", // deeper red matching UI vibe
    borderWidth: 1,
    borderColor: "#991b1b",
  },
  keepBtn: {
    backgroundColor: "#262626", // dark gray
    borderWidth: 1,
    borderColor: "#404040",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  cancelText: {
    color: "#737373",
    fontSize: 16,
    fontWeight: "600",
  },
});
