import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
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

type Client = {
  id: string;
  cui: string;
  name: string;
};

export default function DashboardScreen({ navigation, route }: Props) {
  const { token, serverUrl } = route.params;
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCui, setNewClientCui] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // QR Code payload for mobile client
  const qrPayload = JSON.stringify({
    server_url: serverUrl,
    token: token,
  });

  // Load client list and active client selection
  useEffect(() => {
    const loadClients = async () => {
      try {
        const [profileRes, clientsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/clients`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (clientsRes.ok) {
          const list = await clientsRes.json();
          setClients(list);

          if (profileRes.ok) {
            const profile = await profileRes.json();
            if (profile.active_client_id) {
              const found = list.find((c: Client) => c.id === profile.active_client_id);
              setActiveClient(found || null);
            }
          }
        }
      } catch {
        // Silently fail, the user can still validate receipts
      } finally {
        setIsLoadingClients(false);
      }
    };

    loadClients();
  }, [token]);

  const handleSelectClient = async (client: Client) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/me/active-client`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: client.id }),
      });
      if (response.ok) {
        setActiveClient(client);
      }
    } catch {
      // Ignore network errors, keep previous selection visible
    } finally {
      setShowClientPicker(false);
    }
  };

  const handleCreateClient = async () => {
    setIsCreatingClient(true);
    setCreateClientError(null);

    const name = newClientName.trim();
    const cui = newClientCui.trim();
    const address = newClientAddress.trim() || null;

    if (!name || !cui) {
      setCreateClientError("Completează numele și CUI-ul clientului.");
      setIsCreatingClient(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, cui, address }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Eroare la crearea clientului.");
      }

      const newClient: Client = { id: data.id, name: data.name, cui: data.cui };
      setClients((prev) => [...prev, newClient]);
      await handleSelectClient(newClient);
      setNewClientName("");
      setNewClientCui("");
      setNewClientAddress("");
      setShowCreateClient(false);
    } catch (error: any) {
      setCreateClientError(error.message);
    } finally {
      setIsCreatingClient(false);
    }
  };

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
        {/* Active Client Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Client Activ</Text>
            {isLoadingClients && <ActivityIndicator size="small" color="#6366f1" />}
          </View>
          <Text style={styles.sectionDescription}>
            Bonurile fotografiate de pe telefon vor fi asociate automat acestui
            client până la o nouă selecție.
          </Text>

          <View style={styles.clientCard}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>
                {activeClient ? activeClient.name : "Niciun client selectat"}
              </Text>
              <Text style={styles.clientCui}>
                {activeClient ? `CUI: ${activeClient.cui}` : "—"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clientButton}
              onPress={() => setShowClientPicker(true)}
            >
              <Text style={styles.clientButtonText}>
                {activeClient ? "Schimbă clientul" : "Alege client"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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

      {/* Client picker overlay */}
      {showClientPicker && (
        <View style={styles.overlay}>
          <View style={styles.picker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selectează client activ</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {clients.length === 0 ? (
                <Text style={styles.emptyText}>Nu există clienți. Adaugă unul mai întâi.</Text>
              ) : (
                clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.pickerItem,
                      activeClient?.id === client.id && styles.pickerItemActive,
                    ]}
                    onPress={() => handleSelectClient(client)}
                  >
                    <Text style={styles.pickerItemName}>{client.name}</Text>
                    <Text style={styles.pickerItemCui}>CUI: {client.cui}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addClientButton}
              onPress={() => {
                setShowClientPicker(false);
                setShowCreateClient(true);
              }}
            >
              <Text style={styles.addClientButtonText}>+ Adaugă client nou</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Create client overlay */}
      {showCreateClient && (
        <View style={styles.overlay}>
          <View style={styles.picker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Client nou</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateClient(false);
                  setCreateClientError(null);
                }}
              >
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nume firmă / client</Text>
              <TextInput
                style={styles.formInput}
                value={newClientName}
                onChangeText={setNewClientName}
                placeholder="Ex. SC Example SRL"
                placeholderTextColor="#64748b"
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>CUI</Text>
              <TextInput
                style={styles.formInput}
                value={newClientCui}
                onChangeText={setNewClientCui}
                placeholder="RO12345678 sau 12345678"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Adresă (opțional)</Text>
              <TextInput
                style={styles.formInput}
                value={newClientAddress}
                onChangeText={setNewClientAddress}
                placeholder="Ex. Strada, oraș, județ"
                placeholderTextColor="#64748b"
              />
            </View>

            {createClientError && (
              <View style={styles.createClientError}>
                <Text style={styles.createClientErrorText}>{createClientError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.createClientButton,
                isCreatingClient && styles.createClientButtonDisabled,
              ]}
              onPress={handleCreateClient}
              disabled={isCreatingClient}
            >
              {isCreatingClient ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.createClientButtonText}>Creează client</Text>
              )}
            </TouchableOpacity>
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
  clientCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  clientCui: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  clientButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#6366f1",
    borderRadius: 8,
    marginLeft: 12,
  },
  clientButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    zIndex: 100,
  },
  picker: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    width: "100%",
    maxWidth: 520,
    maxHeight: "80%",
    padding: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  pickerClose: {
    fontSize: 18,
    color: "#94a3b8",
    padding: 4,
  },
  pickerList: {
    paddingBottom: 10,
  },
  pickerItem: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  pickerItemActive: {
    borderColor: "#6366f1",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  pickerItemCui: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  addClientButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    alignItems: "center",
  },
  addClientButtonText: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e2e8f0",
    fontSize: 14,
  },
  createClientError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 12,
    marginBottom: 16,
  },
  createClientErrorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  createClientButton: {
    height: 48,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  createClientButtonDisabled: {
    opacity: 0.7,
  },
  createClientButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
