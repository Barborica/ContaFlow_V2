import React, { useState, useRef } from "react";
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

  // Referință către componenta camerei pentru a putea declanșa funcția de poză
  const cameraRef = useRef<CameraView>(null);

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

  // 1. Funcția pentru scanarea QR-ului (Rămâne neschimbată)
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

  // 2. Funcția NOUĂ pentru fotografierea și trimiterea bonului
  const takePicture = async () => {
    if (cameraRef.current) {
      setIsUploading(true);
      try {
        // Facem poza la calitate medie pentru a se trimite rapid
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });

        if (!photo) throw new Error("Nu s-a putut captura imaginea.");

        // Extragem datele securizate din memorie
        const serverUrl = await SecureStore.getItemAsync("server_url");
        const token = await SecureStore.getItemAsync("user_token");

        // Construim pachetul multipart/form-data
        const formData = new FormData();
        formData.append("file", {
          uri: photo.uri,
          name: "receipt.jpg",
          type: "image/jpeg",
        } as any);

        // Trimitem request-ul către FastAPI
        const response = await fetch(`${serverUrl}/api/v1/receipts/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // Autentificarea!
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          Alert.alert("Succes", "Bonul a fost trimis către server!");
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

  // Dacă suntem conectați, afișăm interfața de făcut poze la bonuri
  if (connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pozează Bonul Fiscal</Text>
        <View style={styles.barcodebox}>
          {/* Am oprit scanarea de coduri QR, folosim camera doar pentru poze */}
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            ref={cameraRef}
          />
        </View>

        {isUploading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <Button title="📸 Captură Bon" onPress={takePicture} color="green" />
        )}
      </View>
    );
  }

  // Interfața inițială de scanare QR
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
});
