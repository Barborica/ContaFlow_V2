import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeClientName, setActiveClientName] = useState<string | null>(null);
  const [activeClientCui, setActiveClientCui] = useState<string | null>(null);

  // Reference to the camera component to trigger picture capture
  const cameraRef = useRef<CameraView>(null);

  // Fetch the active client selected on the web dashboard
  useEffect(() => {
    if (!connected) {
      setActiveClientName(null);
      setActiveClientCui(null);
      return;
    }

    const loadActiveClient = async () => {
      try {
        const serverUrl = await SecureStore.getItemAsync("server_url");
        const token = await SecureStore.getItemAsync("user_token");
        if (!serverUrl || !token) return;

        const response = await fetch(`${serverUrl}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const profile = await response.json();
        if (profile.active_client_id) {
          const clientsRes = await fetch(`${serverUrl}/api/v1/clients`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (clientsRes.ok) {
            const clients = await clientsRes.json();
            const found = clients.find((c: any) => c.id === profile.active_client_id);
            if (found) {
              setActiveClientName(found.name);
              setActiveClientCui(found.cui);
            }
          }
        }
      } catch {
        // Ignore errors; the upload endpoint will warn if no client is selected
      }
    };

    loadActiveClient();
  }, [connected]);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", marginBottom: 20 }}>
          Avem nevoie de permisiunea camerei.
        </Text>
        <Button onPress={requestPermission} title="Permite Acces Camera" />
      </View>
    );
  }

  // 1. QR Code scanning handler
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    try {
      const payload = JSON.parse(data);
      if (payload.server_url && payload.token) {
        await SecureStore.setItemAsync("server_url", payload.server_url);
        await SecureStore.setItemAsync("user_token", payload.token);
        setConnected(true);
        Alert.alert("Conectare Reușită!", "Acum poți poza bonuri.");
      } else {
        Alert.alert("Eroare", "Cod QR invalid.");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Eroare", "Nu am putut citi codul QR.");
      setScanned(false);
    }
  };

  // 2. Picture capture and upload handler
  const takePicture = async () => {
    if (cameraRef.current) {
      setIsUploading(true);
      try {
        // Capture image at medium quality for faster network transmission
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });

        if (!photo) throw new Error("Nu s-a putut captura imaginea.");

        // Retrieve secured configurations from storage
        const serverUrl = await SecureStore.getItemAsync("server_url");
        const token = await SecureStore.getItemAsync("user_token");

        // Construct multipart/form-data payload
        const formData = new FormData();
        formData.append("file", {
          uri: photo.uri,
          name: "receipt.jpg",
          type: "image/jpeg",
        } as any);

        // Send POST request to FastAPI endpoint
        const response = await fetch(`${serverUrl}/api/v1/receipts/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // Bearer authentication
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          Alert.alert(
            "Trimis",
            result.message ||
              "Bonul a fost trimis și se procesează. Poți poza următorul bon.",
          );
        } else {
          Alert.alert(
            "Eroare Server",
            result.detail || "Ceva nu a funcționat.",
          );
        }
      } catch (error: any) {
        Alert.alert("Eroare Upload", error.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Render camera interface for receipt capture if connected
  if (connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pozează Bonul Fiscal</Text>

        {/* Active client context banner */}
        <View
          style={[
            styles.clientBanner,
            activeClientName ? styles.clientBannerActive : styles.clientBannerWarning,
          ]}
        >
          <Text style={styles.clientBannerText}>
            {activeClientName
              ? `Client: ${activeClientName}${activeClientCui ? ` (${activeClientCui})` : ""}`
              : "Atenție: niciun client activ selectat în dashboard."}
          </Text>
        </View>

        <View style={styles.barcodebox}>
          {/* QR code scanning is disabled; camera is only used for taking photos */}
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            ref={cameraRef}
          />
        </View>

        {isUploading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <Button title="Captură Bon" onPress={takePicture} color="green" />
        )}
      </View>
    );
  }

  // Initial QR Code scanning interface
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scanează codul de pe PC</Text>
      <View style={styles.barcodebox}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
      </View>
      {scanned && (
        <Button title="Scanează din nou" onPress={() => setScanned(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  barcodebox: {
    alignItems: "center",
    justifyContent: "center",
    height: 400,
    width: "100%",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "black",
    marginBottom: 20,
  },
  clientBanner: {
    width: "100%",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  clientBannerActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  clientBannerWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  clientBannerText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
    textAlign: "center",
  },
});
