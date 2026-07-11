import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { API_BASE_URL } from "../config";

// Screen props type configuration for React Navigation
type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Construct authentication payload in OAuth2 application / x - www - form - urlencoded format
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const authResponse = await fetch(
        `${API_BASE_URL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        },
      );

      const authData = await authResponse.json();

      if (!authResponse.ok) {
        throw new Error(authData.detail || "Eroare la autentificare");
      }

      // Fetch LAN IP for mobile QR payload
      const ipResponse = await fetch(
        `${API_BASE_URL}/api/v1/system/network-info`,
      );
      const ipData = await ipResponse.json();
      const serverUrl = `http://${ipData.local_ip}:${ipData.port}`;

      // Persist session so it survives page refresh
      localStorage.setItem("contaflow_token", authData.access_token);
      localStorage.setItem("contaflow_server_url", serverUrl);

      navigation.replace("Dashboard", {
        token: authData.access_token,
        serverUrl: serverUrl,
      });
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Simulated background accent layer */}
      <View style={styles.backgroundAccent} />

      <View style={styles.card}>
        {/* Logo / Header Header Content */}
        <View style={styles.logoContainer}>
          <Text style={styles.title}>ContaFlow</Text>
          <Text style={styles.subtitle}>Autentificare Contabil</Text>
        </View>

        {/* Error Messaging Output Block */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Input Fields Fields Form Block */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Adresă de email</Text>
          <TextInput
            style={styles.input}
            placeholder="contabil@firma.ro"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Parolă</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Submit Control Action */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#6366f1"
            style={{ marginTop: 10 }}
          />
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Autentificare</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footerText}>
          Conectează-te pentru a gestiona bonurile fiscale
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  backgroundAccent: {
    position: "absolute",
    top: -200,
    right: -200,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  card: {
    width: "90%",
    maxWidth: 420,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 36,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f1f5f9",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    height: 48,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#f1f5f9",
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#6366f1",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 20,
  },
});
