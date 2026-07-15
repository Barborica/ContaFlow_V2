import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { API_BASE_URL } from "../config";

type Props = NativeStackScreenProps<RootStackParamList, "Validation">;

// Editable receipt item kept as strings for easier TextInput handling
type ReceiptItem = {
  id: string;
  description: string | null;
  quantity: string;
  unit_price: string;
  total_price: string;
};

export default function ValidationScreen({ navigation, route }: Props) {
  const { receiptId, token } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Editable form fields, prefilled from OCR data
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [supplierCui, setSupplierCui] = useState("");
  const [clientCui, setClientCui] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);

  // Fetch full receipt data on mount
  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/receipts/${receiptId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Eroare la încărcarea bonului.");
        }
        setImagePath(data.temp_path);
        setCompanyName(data.company_name || "");
        setSupplierCui(data.supplier_cui || "");
        setClientCui(data.client_cui || "");
        setDate(data.date || "");
        setTotal(data.total_amount != null ? String(data.total_amount) : "");
        setItems(
          (data.items || []).map((item: any) => ({
            id: item.id,
            description: item.description || "",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit_price:
              item.unit_price != null ? String(item.unit_price) : "",
            total_price:
              item.total_price != null ? String(item.total_price) : "",
          }))
        );
      } catch (error: any) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReceipt();
  }, [receiptId, token]);

  // Swap supplier and client CUIs (OCR often reads them in reversed order)
  const handleSwitchCui = () => {
    setSupplierCui(clientCui);
    setClientCui(supplierCui);
  };

  const recalcTotal = (nextItems: ReceiptItem[]) => {
    const sum = nextItems.reduce((acc, item) => {
      return acc + (parseFloat(item.total_price) || 0);
    }, 0);
    setTotal(sum.toFixed(2));
  };

  const updateItem = (
    id: string,
    field: keyof ReceiptItem,
    value: string
  ) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_price") {
          const quantity = parseFloat(updated.quantity.replace(",", "."));
          const unitPrice = parseFloat(updated.unit_price.replace(",", "."));
          updated.total_price =
            Number.isFinite(quantity) && Number.isFinite(unitPrice)
              ? (quantity * unitPrice).toFixed(2)
              : "";
        }
        return updated;
      });
      recalcTotal(next);
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        description: "",
        quantity: "1",
        unit_price: "",
        total_price: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      recalcTotal(next);
      return next;
    });
  };

  const handleDeleteReceipt = async () => {
    if (!window.confirm("Ștergi definitiv acest bon și poza asociată?")) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/receipts/${receiptId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Nu am putut șterge bonul.");
      }
      navigation.goBack();
    } catch (error: any) {
      setSaveError(error.message || "Nu am putut șterge bonul.");
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    setIsSaving(true);
    setSaveError(null);
    setInfoMessage(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/receipts/${receiptId}/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_name: companyName,
            supplier_cui: supplierCui,
            client_cui: clientCui,
            date,
            total_amount: total ? parseFloat(total) : null,
            items: items.map((item) => ({
              description: item.description,
              quantity: parseFloat(item.quantity) || 0,
              unit_price: parseFloat(item.unit_price) || 0,
              total_price: parseFloat(item.total_price) || 0,
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Eroare la validare.");
      }
      setInfoMessage("Bonul a fost validat și salvat.");
      setTimeout(() => navigation.goBack(), 1200);
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Înapoi la Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Validare Bon</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : (
        <View style={styles.split}>
          {/* Left: receipt image with in-place zoom/pan */}
          <View style={styles.imagePanel}>
            <View
              style={styles.imageViewport}
              onLayout={(event) => setPanelSize(event.nativeEvent.layout)}
            >
              {imagePath && panelSize ? (
                <View
                  style={[
                    styles.panContainer,
                    {
                      width: panelSize.width,
                      height: panelSize.height,
                      overflow: "auto" as any,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: `${API_BASE_URL}/uploads/temp/${imagePath}` }}
                    style={{
                      width: panelSize.width * imageZoom,
                      height: panelSize.height * imageZoom,
                    }}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <Text style={styles.emptyText}>Imagine indisponibilă</Text>
              )}
            </View>

            {/* Zoom controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => setImageZoom((z) => Math.max(z - 0.25, 0.5))}
              >
                <Text style={styles.zoomButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.zoomLevel}>{Math.round(imageZoom * 100)}%</Text>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => setImageZoom((z) => Math.min(z + 0.25, 3))}
              >
                <Text style={styles.zoomButtonText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => setImageZoom(1)}
              >
                <Text style={styles.zoomButtonText}>⟲</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right: editable form */}
          <ScrollView
            style={styles.formPanel}
            contentContainerStyle={styles.formInner}
          >
            <Text style={styles.formTitle}>Date extrase</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Denumire furnizor</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Nedetectat"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CUI furnizor</Text>
              <TextInput
                style={styles.input}
                value={supplierCui}
                onChangeText={setSupplierCui}
                placeholder="Nedetectat"
                placeholderTextColor="#64748b"
              />
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={handleSwitchCui}
            >
              <Text style={styles.switchText}>
                ⇅ Interschimbă furnizor ↔ client
              </Text>
            </TouchableOpacity>

            <View style={styles.field}>
              <Text style={styles.label}>CUI client</Text>
              <TextInput
                style={styles.input}
                value={clientCui}
                onChangeText={setClientCui}
                placeholder="Nedetectat"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.flex1]}>
                <Text style={styles.label}>Dată</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-LL-ZZ"
                  placeholderTextColor="#64748b"
                />
              </View>
              <View style={[styles.field, styles.flex1]}>
                <Text style={styles.label}>Total (LEI)</Text>
                <TextInput
                  style={styles.input}
                  value={total}
                  onChangeText={setTotal}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            {/* Line items */}
            <View style={styles.itemsHeader}>
              <Text style={styles.label}>Produse</Text>
              <TouchableOpacity onPress={addItem}>
                <Text style={styles.addItemText}>+ Adaugă produs</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <Text style={styles.emptyItems}>Niciun produs detectat.</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInputs}>
                    <TextInput
                      style={[styles.input, styles.itemDescInput]}
                      value={item.description || ""}
                      onChangeText={(value) =>
                        updateItem(item.id, "description", value)
                      }
                      placeholder="Descriere produs"
                      placeholderTextColor="#64748b"
                    />
                    <View style={styles.itemNumbers}>
                      <TextInput
                        style={[styles.input, styles.itemNumberInput]}
                        value={item.quantity}
                        onChangeText={(value) =>
                          updateItem(item.id, "quantity", value)
                        }
                        keyboardType="decimal-pad"
                        placeholder="Qty"
                        placeholderTextColor="#64748b"
                      />
                      <Text style={styles.itemX}>×</Text>
                      <TextInput
                        style={[styles.input, styles.itemNumberInput]}
                        value={item.unit_price}
                        onChangeText={(value) =>
                          updateItem(item.id, "unit_price", value)
                        }
                        keyboardType="decimal-pad"
                        placeholder="Preț"
                        placeholderTextColor="#64748b"
                      />
                      <Text style={styles.itemX}>=</Text>
                      <TextInput
                        style={[styles.input, styles.itemNumberInput]}
                        value={item.total_price}
                        onChangeText={(value) =>
                          updateItem(item.id, "total_price", value)
                        }
                        keyboardType="decimal-pad"
                        placeholder="Total"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <Text style={styles.removeItemText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity
              style={[styles.deleteButton, isSaving && styles.validateButtonDisabled]}
              onPress={handleDeleteReceipt}
              disabled={isSaving}
            >
              <Text style={styles.deleteButtonText}>Șterge bonul</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.validateButton,
                isSaving && styles.validateButtonDisabled,
              ]}
              onPress={handleValidate}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.validateText}>Validează și salvează</Text>
              )}
            </TouchableOpacity>

            {saveError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{saveError}</Text>
              </View>
            )}

            {infoMessage && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{infoMessage}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 15,
    textAlign: "center",
  },
  split: {
    flex: 1,
    flexDirection: "row",
  },
  imagePanel: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 24,
    overflow: "hidden",
  },
  imageViewport: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  panContainer: {
    flex: 1,
    width: "100%",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  formPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: "#1e293b",
  },
  formInner: {
    padding: 32,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  flex1: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 46,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#f1f5f9",
  },
  switchButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    marginBottom: 16,
  },
  switchText: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyItems: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 16,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addItemText: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "600",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  itemInputs: {
    flex: 1,
    gap: 10,
  },
  itemDescInput: {
    height: 40,
  },
  itemNumbers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemNumberInput: {
    height: 40,
    flex: 1,
    minWidth: 60,
    textAlign: "center",
  },
  itemX: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  removeItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeItemText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteButton: {
    height: 46,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  deleteButtonText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "600",
  },
  validateButton: {
    height: 50,
    backgroundColor: "#6366f1",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  validateButtonDisabled: {
    opacity: 0.7,
  },
  validateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    color: "#a5b4fc",
    fontSize: 13,
    textAlign: "center",
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
  },
  errorBoxText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  zoomControls: {
    position: "absolute",
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 12,
    padding: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
    zIndex: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomButtonText: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "700",
  },
  zoomLevel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    minWidth: 42,
    textAlign: "center",
  },
});
