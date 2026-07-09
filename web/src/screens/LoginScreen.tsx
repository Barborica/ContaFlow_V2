import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import QRCode from "react-qr-code";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Store QR code data
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const authResponse = await fetch(
        "http://127.0.0.1:8000/api/v1/auth/login",
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
        throw new Error(authData.detail || "Authentication error");
      }

      // Ask for server ip address
      const ipResponse = await fetch(
        "http://127.0.0.1:8000/api/v1/system/network-info",
      );
      const ipData = await ipResponse.json();

      // Generate JSON for phone
      const serverUrl = `http://${ipData.local_ip}:${ipData.port}`;
      const payload = JSON.stringify({
        server_url: serverUrl,
        token: authData.access_token,
      });

      setQrPayload(payload);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (qrPayload) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You are logged in!</Text>
        <Text style={styles.subtitle}>
          Scan the code below using the ContaFlow mobile app:
        </Text>
        <View style={styles.qrContainer}>
          <QRCode value={qrPayload} size={250} />
        </View>

        <Text style={styles.infoText}>
          This code contains your secured data and regenerates at every login.
        </Text>
      </View>
    );
  }

  // Login interface
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ContaFlow</Text>
      <Text style={styles.subtitle}>Autentificare Contabil</Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Sign In" onPress={handleLogin} />
      )}
    </View>
  );
}

// CSS Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    maxWidth: 400,
    height: 50,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  infoText: { fontSize: 14, color: "#888", textAlign: "center", maxWidth: 400 },
});
