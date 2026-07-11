import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import QRCode from "react-qr-code";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { API_BASE_URL, WS_BASE_URL } from "../config";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

// Pending receipt data structure matching backend response
type PendingReceipt = {
  receipt_id: string;
  temp_path: string;
  parsed_data: {
    company_name: string | null;
    supplier_cui: string | null;
    client_cui: string | null;
    date: string | null;
    total: number | null;
  };
};

export default function DashboardScreen({ navigation, route }: Props) {
  const { token, serverUrl } = route.params;
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // QR Code payload for mobile client
  const qrPayload = JSON.stringify({
    server_url: serverUrl,
    token: token,
  });

  // Connect to WebSocket on mount, disconnect on unmount
  useEffect(() => {
    // WebSocket connects via localhost (same machine), not LAN IP
    const wsUrl = `${WS_BASE_URL}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === "new_receipt") {
          // Prepend new receipt to the list
          setPendingReceipts((prev) => [message.data, ...prev]);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  // Load existing pending receipts on mount
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/receipts/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Map backend response to match our PendingReceipt type
          const mapped = data.map((r: any) => ({
            receipt_id: r.id,
            temp_path: r.temp_path,
            parsed_data: {
              company_name: null,
              supplier_cui: null,
              client_cui: null,
              date: r.date,
              total: r.total_amount,
            },
          }));
          setPendingReceipts(mapped);
        }
      } catch {
        // Silently fail, receipts will arrive via WebSocket
      }
    };
    fetchPending();
  }, [token]);

  const handleLogout = () => {
    wsRef.current?.close();
    localStorage.removeItem("contaflow_token");
    localStorage.removeItem("contaflow_server_url");
    navigation.replace("Login");
  };

  const handleOpenReceipt = (receipt: PendingReceipt) => {
    navigation.navigate("Validation", {
      receiptId: receipt.receipt_id,
      serverUrl: serverUrl,
      token: token,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ContaFlow</Text>
          <Text style={styles.headerSubtitle}>Panou de Control</Text>
        </View>
        <View style={styles.headerRight}>
          {/* WebSocket connection status indicator */}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: wsConnected ? "#34d399" : "#f87171" },
            ]}
          />
          <Text style={styles.statusText}>
            {wsConnected ? "Conectat" : "Deconectat"}
          </Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Deconectare</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {/* QR Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conectare Telefon</Text>
          <Text style={styles.sectionDescription}>
            Scanează codul de mai jos cu aplicația ContaFlow de pe telefon
            pentru a începe fotografierea bonurilor fiscale.
          </Text>

          <View style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrPayload}
                size={200}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </View>
            <Text style={styles.qrHint}>
              Codul conține token-ul tău securizat.{"\n"}Se regenerează la
              fiecare autentificare.
            </Text>
          </View>
        </View>

        {/* Pending Receipts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bonuri în Așteptare</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingReceipts.length}</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>
            Bonurile fotografiate de pe telefon vor apărea aici automat pentru
            validare.
          </Text>

          {pendingReceipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Niciun bon în așteptare.{"\n"}Fotografiază un bon de pe telefon
                pentru a începe.
              </Text>
            </View>
          ) : (
            pendingReceipts.map((receipt) => (
              <TouchableOpacity
                key={receipt.receipt_id}
                style={styles.receiptCard}
                onPress={() => handleOpenReceipt(receipt)}
                activeOpacity={0.7}
              >
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptCui}>
                    {receipt.parsed_data.supplier_cui || "CUI nedetectat"}
                  </Text>
                  <Text style={styles.receiptDate}>
                    {receipt.parsed_data.date || "Dată nedetectată"}
                  </Text>
                </View>
                <View style={styles.receiptRight}>
                  <Text style={styles.receiptTotal}>
                    {receipt.parsed_data.total
                      ? `${receipt.parsed_data.total.toFixed(2)} LEI`
                      : "—"}
                  </Text>
                  <Text style={styles.receiptArrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#94a3b8",
    marginRight: 12,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 32,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 22,
    marginBottom: 20,
  },
  badge: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  qrCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 16,
  },
  qrHint: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  receiptCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  receiptInfo: {
    flex: 1,
  },
  receiptCui: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  receiptDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  receiptRight: {
    alignItems: "flex-end",
  },
  receiptTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#34d399",
  },
  receiptArrow: {
    fontSize: 18,
    color: "#6366f1",
    marginTop: 4,
  },
});
