import React, { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ValidationScreen from "./src/screens/ValidationScreen";

// Define route types and their parameters for autocomplete and type safety
export type RootStackParamList = {
  Login: undefined;
  Dashboard: { token: string; serverUrl: string };
  Validation: { receiptId: string; serverUrl: string; token: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [savedSession, setSavedSession] = useState<{
    token: string;
    serverUrl: string;
  } | null>(null);

  // Check localStorage for persisted session on mount
  useEffect(() => {
    const token = localStorage.getItem("contaflow_token");
    const serverUrl = localStorage.getItem("contaflow_server_url");
    if (token && serverUrl) {
      setSavedSession({ token, serverUrl });
    }
    setIsReady(true);
  }, []);

  // Show loading while checking session
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={savedSession ? "Dashboard" : "Login"}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          initialParams={savedSession ?? undefined}
        />
        <Stack.Screen name="Validation" component={ValidationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
