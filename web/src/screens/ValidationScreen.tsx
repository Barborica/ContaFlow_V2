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
  const [receiptStatus, setReceiptStatus] = useState("");
  const [imageZoom, setImageZoom] = useState(1);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [supplierCui, setSupplierCui] = useState("");
  const [clientCui, setClientCui] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  // Client verification modals
  const [showClientSwitchModal, setShowClientSwitchModal] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [matchedClient, setMatchedClient] = useState<{ id: string; name: string; cui: string } | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCui, setNewClientCui] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [clientModalError, setClientModalError] = useState<string | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  // Pending switch_client_id to pass to submitValidation after modal flow
  const [pendingSwitchClientId, setPendingSwitchClientId] = useState<string | null>(null);

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
        setImagePath(data.image_url || null);
        setReceiptStatus(data.status || "");
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

  const submitValidation = async (switchClientId?: string | null) => {
    setIsSaving(true);
    setSaveError(null);
    setInfoMessage(null);

    try {
      const body: any = {
        company_name: companyName,
        supplier_cui: supplierCui,
        client_cui: clientCui,
        date,
        total_amount: total ? parseFloat(total) : null,
        items: items.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity.replace(",", ".")) || 0,
          unit_price: parseFloat(item.unit_price.replace(",", ".")) || 0,
          total_price: parseFloat(item.total_price.replace(",", ".")) || 0,
        })),
      };
      if (switchClientId) {
        body.switch_client_id = switchClientId;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/receipts/${receiptId}/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Eroare la validare.");
      setInfoMessage(
        receiptStatus === "validated"
          ? "Modificările au fost salvate."
          : "Bonul a fost validat și salvat.",
      );
      setPendingSwitchClientId(null);
      setTimeout(() => navigation.goBack(), 1200);
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openSupplierModal = async () => {
    setSupplierName(companyName);
    setSupplierAddress("");
    setSupplierModalError(null);
    setShowSupplierModal(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company-lookup?cui=${encodeURIComponent(supplierCui)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) return;
      const data = await response.json();
      setSupplierName(data.name || companyName);
      setSupplierAddress(data.address || "");
    } catch {
    }
  };

  // Normalize CUI for comparison (strip RO/R0, non-digits)
  const normalizeCui = (cui: string) => {
    return cui.toUpperCase().replace(/\s/g, "").replace(/\./g, "").replace(/^(RO|R0)/, "").replace(/\D/g, "");
  };

  // Core flow: check supplier → check client → submit
  const handleValidate = async () => {
    setSaveError(null);

    if (items.length === 0) {
      setSaveError("Bonul trebuie să conțină cel puțin un produs.");
      return;
    }

    // Step 1: Verify supplier (existing flow)
    if (supplierCui.trim()) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/suppliers/by-cui?cui=${encodeURIComponent(supplierCui)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.status === 404) {
          // Will call verifyClientCui() after supplier is created
          await openSupplierModal();
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Nu am putut verifica furnizorul.");
        }
      } catch (error: any) {
        setSaveError(error.message || "Nu am putut verifica furnizorul.");
        return;
      }
    }

    // Step 2: Verify client CUI
    await verifyClientCui();
  };

  const verifyClientCui = async (switchId?: string | null) => {
    const trimmedCui = clientCui.trim();
    if (!trimmedCui) {
      await submitValidation(switchId);
      return;
    }

    try {
      // Fetch the current active client to compare CUIs
      const profileRes = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) {
        await submitValidation(switchId);
        return;
      }
      const profile = await profileRes.json();

      // If there is an active client, fetch it to get its CUI
      if (profile.active_client_id) {
        const clientsRes = await fetch(`${API_BASE_URL}/api/v1/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (clientsRes.ok) {
          const allClients = await clientsRes.json();
          const activeClient = allClients.find((c: any) => c.id === profile.active_client_id);
          if (activeClient && normalizeCui(trimmedCui) === normalizeCui(activeClient.cui)) {
            // CUI matches active client — proceed normally
            await submitValidation(switchId);
            return;
          }
        }
      }

      // CUI does not match (or no active client) — check if this CUI exists in DB
      const cuiRes = await fetch(
        `${API_BASE_URL}/api/v1/clients/by-cui?cui=${encodeURIComponent(trimmedCui)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (cuiRes.ok) {
        // Client exists — ask to switch
        const found = await cuiRes.json();
        setMatchedClient({ id: found.id, name: found.name, cui: found.cui });
        setShowClientSwitchModal(true);
        return;
      }
      if (cuiRes.status === 404) {
        // Client doesn't exist — ask to create
        setNewClientCui(trimmedCui);
        setNewClientName("");
        setNewClientAddress("");
        setClientModalError(null);
        setShowCreateClientModal(true);

        // Pre-fill from external API
        try {
          const lookupRes = await fetch(
            `${API_BASE_URL}/api/v1/company-lookup?cui=${encodeURIComponent(trimmedCui)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (lookupRes.ok) {
            const info = await lookupRes.json();
            setNewClientName(info.name || "");
            setNewClientAddress(info.address || "");
          }
        } catch {
          // Pre-fill is best-effort
        }
        return;
      }

      // Other error — proceed anyway
      await submitValidation(switchId);
    } catch (error: any) {
      setSaveError(error.message || "Nu am putut verifica clientul.");
    }
  };

  // User confirmed switching to an existing client
  const confirmClientSwitch = async () => {
    setShowClientSwitchModal(false);
    if (matchedClient) {
      await submitValidation(matchedClient.id);
    }
  };

  // User confirmed creating a new client and switching to it
  const confirmCreateClient = async () => {
    if (!newClientName.trim()) {
      setClientModalError("Completează denumirea clientului.");
      return;
    }

    setIsCreatingClient(true);
    setClientModalError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newClientName,
          cui: newClientCui,
          address: newClientAddress || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Nu am putut adăuga clientul.");
      setShowCreateClientModal(false);
      await submitValidation(data.id);
    } catch (error: any) {
      setClientModalError(error.message || "Nu am putut adăuga clientul.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const confirmSupplier = async () => {
    if (!supplierName.trim()) {
      setSupplierModalError("Completează denumirea furnizorului.");
      return;
    }

    setIsCreatingSupplier(true);
    setSupplierModalError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/suppliers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: supplierName,
          cui: supplierCui,
          address: supplierAddress || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Nu am putut adăuga furnizorul.");
      setCompanyName(data.name);
      setSupplierCui(data.cui);
      setShowSupplierModal(false);
      // After supplier is created, continue with client verification
      await verifyClientCui();
    } catch (error: any) {
      setSupplierModalError(error.message || "Nu am putut adăuga furnizorul.");
    } finally {
      setIsCreatingSupplier(false);
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
                    source={{ uri: `${API_BASE_URL}${imagePath}` }}
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

            {receiptStatus === "pending" && (
              <TouchableOpacity
                style={[styles.deleteButton, isSaving && styles.validateButtonDisabled]}
                onPress={handleDeleteReceipt}
                disabled={isSaving}
              >
                <Text style={styles.deleteButtonText}>Șterge bonul</Text>
              </TouchableOpacity>
            )}

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
                <Text style={styles.validateText}>
                  {receiptStatus === "validated" ? "Salvează modificările" : "Validează și salvează"}
                </Text>
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

      {/* Supplier modal */}
      {showSupplierModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.supplierModal}>
            <Text style={styles.modalTitle}>Adaugă furnizor în sistem</Text>
            <Text style={styles.modalDescription}>
              Furnizorul nu există. Verifică și completează datele înainte de confirmare.
            </Text>
            <TextInput
              style={styles.input}
              value={supplierName}
              onChangeText={setSupplierName}
              placeholder="Denumire furnizor"
              placeholderTextColor="#64748b"
            />
            <TextInput
              style={styles.input}
              value={supplierCui}
              onChangeText={setSupplierCui}
              placeholder="CUI / CIF"
              placeholderTextColor="#64748b"
            />
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={supplierAddress}
              onChangeText={setSupplierAddress}
              placeholder="Adresă"
              placeholderTextColor="#64748b"
              multiline
            />
            {supplierModalError && (
              <Text style={styles.modalError}>{supplierModalError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSupplierModal(false)}
                disabled={isCreatingSupplier}
              >
                <Text style={styles.modalCancelText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, isCreatingSupplier && styles.validateButtonDisabled]}
                onPress={confirmSupplier}
                disabled={isCreatingSupplier}
              >
                {isCreatingSupplier ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Adaugă și continuă</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Client switch modal — client exists in DB but differs from active */}
      {showClientSwitchModal && matchedClient && (
        <View style={styles.modalOverlay}>
          <View style={styles.supplierModal}>
            <Text style={styles.modalTitle}>Client diferit detectat</Text>
            <Text style={styles.modalDescription}>
              CUI-ul clientului de pe bon ({clientCui}) corespunde clientului
              "{matchedClient.name}" (CUI: {matchedClient.cui}), dar acesta nu
              este clientul activ selectat.{"\n\n"}Dorești să schimbi clientul
              activ și să asociezi bonul cu "{matchedClient.name}"?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowClientSwitchModal(false)}
              >
                <Text style={styles.modalCancelText}>Nu, păstrează clientul curent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmClientSwitch}
              >
                <Text style={styles.modalConfirmText}>Da, schimbă clientul</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Create new client modal — CUI not found in DB */}
      {showCreateClientModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.supplierModal}>
            <Text style={styles.modalTitle}>Client necunoscut</Text>
            <Text style={styles.modalDescription}>
              Nu există un client cu CUI-ul {newClientCui} în sistem.
              Dorești să îl adaugi?
            </Text>
            <TextInput
              style={styles.input}
              value={newClientName}
              onChangeText={setNewClientName}
              placeholder="Denumire client"
              placeholderTextColor="#64748b"
            />
            <TextInput
              style={styles.input}
              value={newClientCui}
              onChangeText={setNewClientCui}
              placeholder="CUI / CIF"
              placeholderTextColor="#64748b"
            />
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={newClientAddress}
              onChangeText={setNewClientAddress}
              placeholder="Adresă"
              placeholderTextColor="#64748b"
              multiline
            />
            {clientModalError && (
              <Text style={styles.modalError}>{clientModalError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCreateClientModal(false)}
                disabled={isCreatingClient}
              >
                <Text style={styles.modalCancelText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, isCreatingClient && styles.validateButtonDisabled]}
                onPress={confirmCreateClient}
                disabled={isCreatingClient}
              >
                {isCreatingClient ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Adaugă și salvează bonul</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  supplierModal: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 20,
  },
  modalTitle: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalDescription: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  addressInput: {
    minHeight: 72,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  modalError: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelButton: {
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#475569",
  },
  modalCancelText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  modalConfirmButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    backgroundColor: "#6366f1",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
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
