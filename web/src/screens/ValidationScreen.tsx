import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Validation">;

// Placeholder component to be fully implemented in sub-stage 1D
export default function ValidationScreen({ navigation, route }: Props) {
  const { receiptId, serverUrl, token } = route.params;

  return (
    <View style={styles.container}>
      {/* Header with Back button navigation control */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Înapoi la Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Validare Bon</Text>
      </View>

      {/* Screen layout placeholder content */}
      <View style={styles.content}>
        <Text style={styles.placeholderTitle}>
          Ecran de Validare — În Construcție
        </Text>
        <Text style={styles.placeholderDescription}>
          Aici va apărea ecranul split-screen:{"\n"}
          Poza bonului (stânga) | Formular editabil (dreapta)
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Receipt ID:</Text>
          <Text style={styles.infoValue}>{receiptId}</Text>
        </View>
      </View>
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
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 20,
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e2e8f0",
    textAlign: "center",
    marginBottom: 12,
  },
  placeholderDescription: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    color: "#6366f1",
    fontSize: 13,
    fontWeight: "600",
  },
});
