import React, { useState } from "react";
import { Text, View, StyleSheet, Button, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", marginBottom: 20 }}>
          Camera permission is required to scan the QR code on the screen.
        </Text>
        <Button onPress={requestPermission} title="Permite Acces Camera" />
      </View>
    );
  }

  const handleBarcodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    setScanned(true);
    try {
      const payload = JSON.parse(data);

      if (payload.server_url && payload.token) {
        await SecureStore.setItemAsync("server_url", payload.server_url);
        await SecureStore.setItemAsync("user_token", payload.token);

        setConnected(true);
        Alert.alert("Connection Successful!", `Your device is now connected.`);
      } else {
        Alert.alert("Eroare", "This QR code does not belong to ContaFlow.");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Eroare", "Could not read the QR code.");
      setScanned(false);
    }
  };

  if (connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Your device is connected!</Text>
        <Text>Worked!</Text>
        {/* Work in progress */}
      </View>
    );
  }

  // QR code scanning interface
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan the code from your PC</Text>

      <View style={styles.barcodebox}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
      </View>

      {scanned && (
        <Button title="Scan again" onPress={() => setScanned(false)} />
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
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  barcodebox: {
    alignItems: "center",
    justifyContent: "center",
    height: 300,
    width: 300,
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "tomato",
    marginBottom: 20,
  },
});
