import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "../../providers/ApiProvider";
import { normalizeHost } from "../../lib/apiBase";
import { HEALTHZ_PATH } from "../../config";
import { fetchWithTimeout } from "../../lib/http";

type Props = { visible: boolean; onClose: () => void };

export default function SettingsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { host, port, baseUrl, setConfig, zoomFactor } = useApi();

  const [hostInput, setHostInput] = useState(host);
  const [portInput, setPortInput] = useState(port);
  const [zoomInput, setZoomInput] = useState(String(zoomFactor)); // 👈 local state
  const [testMsg, setTestMsg] = useState<null | { ok: boolean; text: string }>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (visible) {
      setHostInput(host);
      setZoomInput(String(zoomFactor));
      setPortInput(port);
      setTestMsg(null);
    }
  }, [visible, host, port, zoomFactor]);

  const onSave = async () => {
    const cleanHost = normalizeHost(hostInput || "");
    const cleanPort = String(portInput || "8000").trim();
    if (!/^\d+$/.test(cleanPort)) {
      setTestMsg({ ok: false, text: "Port must be a number" });
      return;
    }
    const zoomParsed = Number(String(zoomInput).replace(",", "."));
    if (Number.isNaN(zoomParsed) || zoomParsed < 1 || zoomParsed > 5) {
      setTestMsg({ ok: false, text: "Zoom must be between 1.0 and 5.0" });
      return;
    }

    setSaving(true);
    try {
      await setConfig(cleanHost, cleanPort, zoomParsed);
      setTestMsg({ ok: true, text: "Saved ✓" });
    } catch {
      setTestMsg({ ok: false, text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    const url = `http://${normalizeHost(hostInput || "192.168.7.141")}:${String(
      portInput || "8000"
    ).trim()}${HEALTHZ_PATH}`;

    setTesting(true);
    setTestMsg(null);

    // fetch with timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    try {
      const r = await fetchWithTimeout(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        setTestMsg({ ok: true, text: "This URL works" });
      } else {
        setTestMsg({ ok: false, text: "This API did not respond" });
      }
    } catch {
      clearTimeout(timer);
      setTestMsg({ ok: false, text: "This API did not respond" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.96)",
          paddingTop: insets.top,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomColor: "#171717",
            borderBottomWidth: 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
            Settings
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              padding: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: "#9ca3af", marginBottom: 4 }}>
            Base URL used for all API calls
          </Text>
          <Text style={{ color: "#fff", fontWeight: "600", marginBottom: 6 }}>
            Current: {baseUrl}
          </Text>

          {/* API URL (host) */}
          <Text style={{ color: "#d1d5db", marginBottom: 6 }}>
            API URL (Host)
          </Text>
          <TextInput
            value={hostInput}
            onChangeText={setHostInput}
            placeholder="192.168.7.141"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={{
              color: "#fff",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />

          {/* API Port */}
          <Text style={{ color: "#d1d5db", marginBottom: 6, marginTop: 8 }}>
            API Port
          </Text>
          <TextInput
            value={String(portInput)}
            onChangeText={setPortInput}
            placeholder="8000"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            style={{
              color: "#fff",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />

          {/* Zoom Factor */}
          <Text style={{ color: "#d1d5db", marginBottom: 6, marginTop: 8 }}>
            Zoom Factor (1.0 – 5.0)
          </Text>
          <TextInput
            value={zoomInput}
            onChangeText={setZoomInput}
            placeholder="1.4"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="decimal-pad"
            style={{
              color: "#fff",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />

          {/* Buttons */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={onSave}
              disabled={saving}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#374151",
                backgroundColor: saving ? "rgba(255,255,255,0.25)" : "#1f2937",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onTest}
              disabled={testing}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                backgroundColor: testing
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {testing ? "Testing..." : "Test"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Test result */}
          {testMsg && (
            <Text
              style={{
                marginTop: 10,
                color: testMsg.ok ? "#22c55e" : "#ef4444",
                fontWeight: "600",
              }}
            >
              {testMsg.text}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
