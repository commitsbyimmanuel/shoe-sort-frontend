import { View, Text, Image } from "react-native";
import type { ApiResponse } from "../../types";

export default function ResultsView({ data }: { data?: ApiResponse | null }) {
  if (!data) {
    return (
      <View style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.dim}>No data</Text>
        </View>
      </View>
    );
  }
  if (data.status === "error") {
    return (
      <View style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.error}>
            {data.message || "Something went wrong"}
          </Text>
        </View>
      </View>
    );
  }
  if (data.status === "pair_found") {
    const imgUri =
      (data as any).pair_image_data_url || (data as any).pair_image_url || null;
    const sim =
      typeof (data as any).cosine_similarity === "number"
        ? ((data as any).cosine_similarity * 100).toFixed(1)
        : null;
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
          <Text style={styles.title}>Pair found</Text>
          {sim ? <Text style={styles.label}>{sim}%</Text> : null}
        </View>
        <View style={{ borderTopColor: "#262626", borderTopWidth: 1 }}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemTitle}>Location</Text>
              <Text style={styles.itemSub}>
                {String((data as any).pair_location)}
              </Text>
              {(data as any).reason ? (
                <Text style={styles.itemSub}>
                  {String((data as any).reason)}
                </Text>
              ) : null}
            </View>
            {imgUri ? (
              <Image
                source={{ uri: imgUri }}
                style={{ width: 96, height: 96, borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (data.status === "add_to_set") {
    return (
      <View style={styles.card}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={styles.title}>No pair yet</Text>
        </View>
        <View style={{ borderTopColor: "#262626", borderTopWidth: 1 }}>
          <View style={styles.row}>
            <Text style={styles.itemTitle}>Location</Text>
            <Text style={styles.itemSub}>{String((data as any).location)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = {
  card: {
    backgroundColor: "rgba(23,23,23,0.7)",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden" as const,
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
  error: { color: "#f87171", fontSize: 14 },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: "#262626",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  itemTitle: { color: "#fff", fontWeight: "600" as const, fontSize: 14 },
  itemSub: { color: "#a3a3a3", fontSize: 12 },
  button: {
    backgroundColor: "#262626",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
};
