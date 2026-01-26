import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";

export default function LocationView({
  updateLocation,
  flipDirection,
}: {
  updateLocation: (
    direction: "ROW_DOWN" | "ROW_UP" | "COLUMN_RIGHT" | "COLUMN_LEFT"
  ) => void;
  flipDirection: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={ui.container}>
          {/* Left column (centered vertically, half-height button) */}
          <View style={ui.sideCol}>
            <TouchableOpacity
              style={[styles.button, ui.halfButton]}
              onPress={() => updateLocation("COLUMN_LEFT")}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Middle column (two half-height buttons with a small gap) */}
          <View style={ui.centerCol}>
            <TouchableOpacity
              style={[styles.secondaryButton, ui.halfButtonCenter]}
              onPress={() => updateLocation("ROW_UP")}
            >
              <Ionicons name="arrow-up" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, ui.halfButtonCenter]}
              onPress={() => {
                updateLocation("ROW_DOWN");
                flipDirection();
              }}
            >
              <Ionicons name="arrow-down" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Right column (centered vertically, half-height button) */}
          <View style={ui.sideCol}>
            <TouchableOpacity
              style={[styles.button, ui.halfButton]}
              onPress={() => updateLocation("COLUMN_RIGHT")}
            >
              <Ionicons name="arrow-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(23,23,23,0.7)",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
  },
  button: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "#1f2937",
    borderColor: "#374151",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 28,
    lineHeight: 28,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  content: {
    flex: 1,
    padding: 0,
    alignItems: "center",
    justifyContent: "center", // ⬅️ centers the arrow grid vertically inside the card
  },
});

const ui = StyleSheet.create({
  // Set overall control footprint (width + total height "h")
  container: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Left/Right columns: center the single half-height button vertically
  sideCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Middle column: stack two half-height buttons with space between
  centerCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 25,
  },

  // Half-height buttons for side columns (h/2)
  halfButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  // Slightly smaller to allow a gap in the middle column
  halfButtonCenter: {
    width: 60,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },
});
