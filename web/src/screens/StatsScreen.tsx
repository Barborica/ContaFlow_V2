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

type Props = NativeStackScreenProps<RootStackParamList, "Stats">;

type Summary = {
  pending_count: number;
  pending_total: number;
  validated_count: number;
  validated_total: number;
  is_admin_view: boolean;
};

type PeriodData = {
  period: string;
  count: number;
  total: number;
};

type AccountantStat = {
  email: string;
  role: string;
  pending_count: number;
  pending_total: number;
  validated_count: number;
  validated_total: number;
};

const PERIODS: Array<{ key: "day" | "month" | "year"; label: string }> = [
  { key: "day", label: "Zi" },
  { key: "month", label: "Lună" },
  { key: "year", label: "An" },
];

export default function StatsScreen({ navigation, route }: Props) {
  const { token, serverUrl } = route.params;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState<"day" | "month" | "year">("month");
  const [periodData, setPeriodData] = useState<PeriodData[]>([]);
  const [accountants, setAccountants] = useState<AccountantStat[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, periodRes, accountantsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/stats/summary`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/stats/by-period?period=${period}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/stats/by-accountant`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!summaryRes.ok) throw new Error("Nu am putut încărca sumarul.");
        if (!periodRes.ok) throw new Error("Nu am putut încărca statisticile pe perioade.");

        setSummary(await summaryRes.json());
        const periodJson = await periodRes.json();
        setPeriodData(periodJson.data);

        if (accountantsRes.ok) {
          setAccountants(await accountantsRes.json());
        } else {
          setAccountants(null);
        }
      } catch (err: any) {
        setError(err.message || "Eroare la încărcarea statisticilor.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [token, period]);

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
        <Text style={styles.headerTitle}>Statistici</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary?.pending_count ?? 0}</Text>
            <Text style={styles.statLabel}>Bonuri de procesat</Text>
            <Text style={styles.statTotal}>
              {(summary?.pending_total ?? 0).toFixed(2)} LEI
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary?.validated_count ?? 0}</Text>
            <Text style={styles.statLabel}>Bonuri validate</Text>
            <Text style={styles.statTotal}>
              {(summary?.validated_total ?? 0).toFixed(2)} LEI
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Bonuri validate pe perioadă</Text>
        <View style={styles.periodSelector}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodButton, period === p.key && styles.periodButtonActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === p.key && styles.periodButtonTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {periodData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nu există date pentru perioada selectată.</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Perioadă</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Bonuri</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Total</Text>
            </View>
            {periodData.map((row) => (
              <View key={row.period} style={styles.tableRow}>
                <Text style={styles.tableCell}>{row.period}</Text>
                <Text style={styles.tableCell}>{row.count}</Text>
                <Text style={[styles.tableCell, styles.tableCellTotal]}>
                  {row.total.toFixed(2)} LEI
                </Text>
              </View>
            ))}
          </View>
        )}

        {accountants && (
          <>
            <Text style={styles.sectionTitle}>Statistici pe contabil</Text>
            {accountants.map((acc) => (
              <View key={acc.email} style={styles.accountantCard}>
                <Text style={styles.accountantEmail}>{acc.email}</Text>
                <Text style={styles.accountantRole}>{acc.role}</Text>
                <View style={styles.accountantStatsRow}>
                  <View style={styles.accountantStat}>
                    <Text style={styles.accountantStatValue}>{acc.validated_count}</Text>
                    <Text style={styles.accountantStatLabel}>validate</Text>
                  </View>
                  <View style={styles.accountantStat}>
                    <Text style={styles.accountantStatValue}>
                      {acc.validated_total.toFixed(2)} LEI
                    </Text>
                    <Text style={styles.accountantStatLabel}>total validat</Text>
                  </View>
                  <View style={styles.accountantStat}>
                    <Text style={styles.accountantStatValue}>{acc.pending_count}</Text>
                    <Text style={styles.accountantStatLabel}>de procesat</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
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
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  statTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 12,
    marginTop: 8,
  },
  periodSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  periodButtonActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  periodButtonText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  periodButtonTextActive: {
    color: "#ffffff",
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
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
    marginBottom: 24,
  },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  tableCell: {
    flex: 1,
    color: "#cbd5e1",
    fontSize: 13,
  },
  tableHeaderCell: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  tableCellTotal: {
    color: "#34d399",
    fontWeight: "600",
  },
  accountantCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 12,
  },
  accountantEmail: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  accountantRole: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "capitalize",
    marginBottom: 12,
  },
  accountantStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  accountantStat: {
    alignItems: "center",
  },
  accountantStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  accountantStatLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
});
