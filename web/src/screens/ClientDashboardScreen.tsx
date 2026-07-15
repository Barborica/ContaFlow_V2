import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { API_BASE_URL } from "../config";

type Props = NativeStackScreenProps<RootStackParamList, "ClientDashboard">;

type Receipt = {
  id: string;
  temp_path: string;
  date: string | null;
  total_amount: number | null;
  supplier_cui: string | null;
  company_name: string | null;
};

type Stats = {
  client_name: string;
  client_cui: string;
  pending_count: number;
  pending_total: number;
  validated_count: number;
  validated_total: number;
};

export default function ClientDashboardScreen({ navigation, route }: Props) {
  const { clientId, token, serverUrl } = route.params;

  const [stats, setStats] = useState<Stats | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [validatedReceipts, setValidatedReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, receiptsRes, validatedRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/clients/${clientId}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/receipts/pending?client_id=${clientId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/receipts/validated?client_id=${clientId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!statsRes.ok) throw new Error("Nu am putut încărca statisticile clientului.");
        if (!receiptsRes.ok || !validatedRes.ok) throw new Error("Nu am putut încărca bonurile.");

        setStats(await statsRes.json());
        setReceipts(await receiptsRes.json());
        setValidatedReceipts(await validatedRes.json());
      } catch (err: any) {
        setError(err.message || "Eroare la încărcarea dashboard-ului.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return navigation.addListener("focus", load);
  }, [clientId, navigation, token]);

  const setActiveClient = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/me/active-client`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      });
      if (res.ok) {
        setActiveMsg("Client setat ca activ.");
        setTimeout(() => setActiveMsg(null), 2000);
      } else {
        setActiveMsg("Eroare la setarea clientului activ.");
      }
    } catch {
      setActiveMsg("Eroare la setarea clientului activ.");
    }
  };

  const openReceipt = (receipt: Receipt) => {
    navigation.navigate("Validation", {
      receiptId: receipt.id,
      serverUrl,
      token,
    });
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
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>{stats?.client_name || "Client"}</Text>
          <Text style={styles.headerSubtitle}>CUI: {stats?.client_cui || "—"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.pending_count ?? 0}</Text>
            <Text style={styles.statLabel}>Bonuri de procesat</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {(stats?.pending_total ?? 0).toFixed(2)} LEI
            </Text>
            <Text style={styles.statLabel}>Total de procesat</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.validated_count ?? 0}</Text>
            <Text style={styles.statLabel}>Bonuri validate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {(stats?.validated_total ?? 0).toFixed(2)} LEI
            </Text>
            <Text style={styles.statLabel}>Total validat</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.activeButton} onPress={setActiveClient}>
          <Text style={styles.activeButtonText}>Setează ca client activ pentru scanare</Text>
        </TouchableOpacity>
        {activeMsg && <Text style={styles.activeMessage}>{activeMsg}</Text>}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bonuri de procesat</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{receipts.length}</Text>
            </View>
          </View>

          {receipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Niciun bon în așteptare pentru acest client.</Text>
            </View>
          ) : (
            receipts.map((receipt) => (
              <TouchableOpacity
                key={receipt.id}
                style={styles.receiptCard}
                onPress={() => openReceipt(receipt)}
                activeOpacity={0.7}
              >
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptSupplier}>
                    {receipt.company_name || receipt.supplier_cui || "Furnizor nedetectat"}
                  </Text>
                  <Text style={styles.receiptDate}>
                    {receipt.date || "Dată nedetectată"}
                  </Text>
                </View>
                <View style={styles.receiptRight}>
                  <Text style={styles.receiptTotal}>
                    {receipt.total_amount
                      ? `${receipt.total_amount.toFixed(2)} LEI`
                      : "—"}
                  </Text>
                  <Text style={styles.receiptArrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bonuri validate</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{validatedReceipts.length}</Text>
            </View>
          </View>

          {validatedReceipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Niciun bon validat pentru acest client.</Text>
            </View>
          ) : (
            validatedReceipts.map((receipt) => (
              <TouchableOpacity
                key={receipt.id}
                style={styles.receiptCard}
                onPress={() => openReceipt(receipt)}
                activeOpacity={0.7}
              >
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptSupplier}>
                    {receipt.company_name || receipt.supplier_cui || "Furnizor nedetectat"}
                  </Text>
                  <Text style={styles.receiptDate}>
                    {receipt.date || "Dată nedetectată"}
                  </Text>
                </View>
                <View style={styles.receiptRight}>
                  <Text style={styles.receiptTotal}>
                    {receipt.total_amount != null
                      ? `${receipt.total_amount.toFixed(2)} LEI`
                      : "—"}
                  </Text>
                  <Text style={styles.receiptArrow}>Editează</Text>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  content: {
    padding: 24,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  activeButton: {
    height: 46,
    backgroundColor: "#6366f1",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  activeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  activeMessage: {
    color: "#cbd5e1",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  badge: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  receiptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  receiptInfo: {
    flex: 1,
  },
  receiptSupplier: {
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
    fontSize: 15,
    fontWeight: "700",
    color: "#34d399",
  },
  receiptArrow: {
    fontSize: 18,
    color: "#6366f1",
    marginTop: 4,
  },
});
