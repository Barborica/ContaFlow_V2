import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Connection">;

export default function ConnectionScreen({ route, navigation }: Props) {
  const { token, serverUrl } = route.params;
  const wsUrl = `${serverUrl.replace(/^http/, "ws")}/ws?role=web`;

  const [networkInfo, setNetworkInfo] = useState<{ local_ip: string; port: number } | null>(null);
  const [qrSource, setQrSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wifiName, setWifiName] = useState("");
  const [copied, setCopied] = useState(false);

  const [backendConnected, setBackendConnected] = useState(false);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Load persisted WiFi name
  useEffect(() => {
    const saved = localStorage.getItem("contaflow_wifi_name");
    if (saved) setWifiName(saved);
  }, []);

  // Persist WiFi name
  useEffect(() => {
    localStorage.setItem("contaflow_wifi_name", wifiName);
  }, [wifiName]);

  // Fetch network info and QR code image
  useEffect(() => {
    const load = async () => {
      try {
        const netRes = await fetch(`${serverUrl}/api/v1/system/network-info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!netRes.ok) throw new Error("Nu am putut citi informațiile de rețea.");
        const netInfo = await netRes.json();
        setNetworkInfo(netInfo);

        const qrRes = await fetch(`${serverUrl}/api/v1/system/qr`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!qrRes.ok) throw new Error("Nu am putut genera codul QR.");
        const blob = await qrRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        setQrSource(objectUrl);
      } catch (err: any) {
        setError(err.message || "Eroare la încărcarea ecranului de conexiune.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [serverUrl, token]);

  // Manage WebSocket connection for live status
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setBackendConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "status") {
              setPhoneConnected(Boolean(msg.phone_connected));
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          setBackendConnected(false);
          setPhoneConnected(false);
          wsRef.current = null;
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setBackendConnected(false);
        };
      } catch {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  const copyServerUrl = async () => {
    const url = networkInfo ? `http://${networkInfo.local_ip}:${networkInfo.port}` : serverUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Înapoi</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conexiune telefon</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={[styles.dot, backendConnected ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusLabel}>
              {backendConnected ? "Backend conectat" : "Backend deconectat"}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.dot, phoneConnected ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusLabel}>
              {phoneConnected ? "Telefon conectat" : "Telefon deconectat"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Rețea WiFi</Text>
          <TextInput
            style={styles.input}
            value={wifiName}
            onChangeText={setWifiName}
            placeholder="Numele rețelei WiFi (opțional)"
            placeholderTextColor="#64748b"
          />
          <Text style={styles.hint}>
            Asigură-te că telefonul este pe aceeași rețea WiFi.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Adresă server</Text>
          <Text style={styles.serverUrl}>
            {networkInfo ? `http://${networkInfo.local_ip}:${networkInfo.port}` : serverUrl}
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyServerUrl}>
            <Text style={styles.copyButtonText}>
              {copied ? "Copiat ✓" : "Copiază adresa"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qrCard}>
          <Text style={styles.label}>Scanează codul QR cu telefonul</Text>
          {qrSource ? (
            <Image source={{ uri: qrSource }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <Text style={styles.emptyText}>Codul QR nu este disponibil.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 16,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  backText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  content: {
    padding: 24,
    gap: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statusItem: {
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotGreen: {
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  dotRed: {
    backgroundColor: "#ef4444",
  },
  statusLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 46,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#f1f5f9",
  },
  hint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
  },
  serverUrl: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  copyButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  copyButtonText: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "600",
  },
  qrCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  qrImage: {
    width: 240,
    height: 240,
    marginTop: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 12,
  },
});
