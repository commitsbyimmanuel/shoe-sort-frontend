import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function LocationView({
  nextShoeLocation,
  goingRight,
  flipDirection,
}: {
  nextShoeLocation?: string | null;
  goingRight: boolean;
  flipDirection: () => void;
}) {
  return (
    <View style={styles.card}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={styles.title}>Next Shoe Location</Text>
      </View>
      <View style={{ borderTopColor: "#262626", borderTopWidth: 1 }}>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.itemTitle}>{nextShoeLocation}</Text>
            <Text style={styles.itemSub} onPress={flipDirection}>
              {goingRight ? (
                <>
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                </>
              ) : (
                <>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </>
              )}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = {
  card: {
    backgroundColor: "rgba(23,23,23,0.7)",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden" as const,
    flex: 1,
  },
  body: { padding: 12 },
  title: {
    color: "#fafafa",
    fontWeight: "600" as const,
    fontSize: 14,
    marginBottom: 4,
  },
  label: { color: "#a3a3a3", fontSize: 12 },
  dim: { color: "#a3a3a3", fontSize: 14 },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: "#262626",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  itemTitle: {
    color: "#f87171",
    fontWeight: "600" as const,
    textAlign: "center" as const,
    fontSize: 58,
  },
  itemSub: { color: "#a3a3a3", fontSize: 24, textAlign: "center" as const },
};
