import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { API_BASE_URL } from "../config";

type Props = NativeStackScreenProps<RootStackParamList, "AdminDashboard">;

type User = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type AuditLogItem = {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  timestamp: string;
};

type Tab = "users" | "audit" | "export";

export default function AdminScreen({ navigation, route }: Props) {
  const { token, serverUrl } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [auditItems, setAuditItems] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"accountant" | "admin">("accountant");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "audit" && auditItems.length === 0) {
      loadAudit(0);
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAudit = async (offset: number) => {
    setAuditLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/audit-log?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (offset === 0) {
        setAuditItems(data.items);
      } else {
        setAuditItems((prev) => [...prev, ...data.items]);
      }
      setAuditTotal(data.total);
      setAuditOffset(offset);
    } finally {
      setAuditLoading(false);
    }
  };

  const createUser = async () => {
    const email = newEmail.trim();
    const password = newPassword.trim();
    if (!email || !password) {
      setCreateError("Completează email și parolă.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Eroare la creare.");
      setUsers((prev) => [...prev, data]);
      setNewEmail("");
      setNewPassword("");
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
        );
      }
    } catch {
      // ignore
    }
  };

  const changeRole = async (user: User) => {
    const nextRole = user.role === "admin" ? "accountant" : "admin";
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
        );
      }
    } catch {
      // ignore
    }
  };

  const deleteUser = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      }
    } catch {
      // ignore
    }
  };

  const exportDatabase = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/export-db`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      a.download = match ? match[1] : "contaflow-backup.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const renderTabs = () => (
    <View style={styles.tabs}>
      {[
        { key: "users", label: "Conturi" },
        { key: "audit", label: "Audit Log" },
        { key: "export", label: "Export" },
      ].map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tab, activeTab === (t.key as Tab) && styles.tabActive]}
          onPress={() => setActiveTab(t.key as Tab)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === (t.key as Tab) && styles.tabTextActive,
            ]}
          >
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderUsers = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>Adaugă utilizator</Text>
      <TextInput
        style={styles.input}
        value={newEmail}
        onChangeText={setNewEmail}
        placeholder="Email"
        placeholderTextColor="#64748b"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Parolă"
        placeholderTextColor="#64748b"
        secureTextEntry
      />
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleButton, newRole === "accountant" && styles.roleButtonActive]}
          onPress={() => setNewRole("accountant")}
        >
          <Text style={newRole === "accountant" ? styles.roleTextActive : styles.roleText}>
            Contabil
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, newRole === "admin" && styles.roleButtonActive]}
          onPress={() => setNewRole("admin")}
        >
          <Text style={newRole === "admin" ? styles.roleTextActive : styles.roleText}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>
      {createError && <Text style={styles.errorText}>{createError}</Text>}
      <TouchableOpacity
        style={[styles.actionButton, creating && styles.actionButtonDisabled]}
        onPress={createUser}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.actionButtonText}>Creează utilizator</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Utilizatori existenți</Text>
      {usersLoading ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : users.length === 0 ? (
        <Text style={styles.emptyText}>Niciun utilizator.</Text>
      ) : (
        users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userMeta}>
                Rol: {user.role} • {user.is_active ? "Activ" : "Inactiv"}
              </Text>
            </View>
            <View style={styles.userActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => toggleActive(user)}
              >
                <Text style={styles.iconButtonText}>
                  {user.is_active ? " Dezactivează" : " Activează"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => changeRole(user)}>
                <Text style={styles.iconButtonText}>Schimbă rol</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.dangerButton]}
                onPress={() => deleteUser(user)}
              >
                <Text style={styles.dangerButtonText}>Șterge</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderAudit = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>
        Audit Log ({auditItems.length} / {auditTotal})
      </Text>
      {auditLoading && auditItems.length === 0 ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : auditItems.length === 0 ? (
        <Text style={styles.emptyText}>Nu există înregistrări în audit log.</Text>
      ) : (
        <>
          {auditItems.map((log) => (
            <View key={log.id} style={styles.auditCard}>
              <Text style={styles.auditAction}>{log.action}</Text>
              <Text style={styles.auditTarget}>
                {log.target_type} / {log.target_id || "—"}
              </Text>
              <Text style={styles.auditMeta}>
                User: {log.user_id || "—"} • {new Date(log.timestamp).toLocaleString()}
              </Text>
              {log.details && (
                <Text style={styles.auditDetails}>
                  {JSON.stringify(log.details)}
                </Text>
              )}
            </View>
          ))}
          {auditItems.length < auditTotal && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => loadAudit(auditOffset + 50)}
              disabled={auditLoading}
            >
              {auditLoading ? (
                <ActivityIndicator size="small" color="#a5b4fc" />
              ) : (
                <Text style={styles.loadMoreText}>Încarcă mai multe</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderExport = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Export baza de date</Text>
      <Text style={styles.emptyText}>
        Descarcă un backup ZIP care conține database.db, folderul uploads și manifest.json.
      </Text>
      <TouchableOpacity
        style={[styles.actionButton, exporting && styles.actionButtonDisabled]}
        onPress={exportDatabase}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.actionButtonText}>Descarcă backup</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const handleLogout = () => {
    localStorage.removeItem("contaflow_token");
    localStorage.removeItem("contaflow_server_url");
    navigation.replace("Login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard Administrator</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Deconectare</Text>
        </TouchableOpacity>
      </View>
      {renderTabs()}
      {activeTab === "users" && renderUsers()}
      {activeTab === "audit" && renderAudit()}
      {activeTab === "export" && renderExport()}
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  logoutButton: {
    paddingHorizontal: 14,
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
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  tabText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  tabContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 12,
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
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  roleText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  roleTextActive: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  actionButton: {
    height: 46,
    backgroundColor: "#6366f1",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 16,
  },
  userCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  userInfo: {
    marginBottom: 10,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  userMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  userActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  iconButtonText: {
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  dangerButtonText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
  auditCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  auditAction: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  auditTarget: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  auditMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
  },
  auditDetails: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
  },
  loadMoreButton: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 10,
  },
  loadMoreText: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "600",
  },
});
