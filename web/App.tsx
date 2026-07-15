import React, { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ValidationScreen from "./src/screens/ValidationScreen";
import ConnectionScreen from "./src/screens/ConnectionScreen";
import ClientsScreen from "./src/screens/ClientsScreen";
import ClientDashboardScreen from "./src/screens/ClientDashboardScreen";
import StatsScreen from "./src/screens/StatsScreen";
import AdminScreen from "./src/screens/AdminScreen";
import { API_BASE_URL } from "./src/config";
import { PhoneConnectionProvider } from "./src/contexts/PhoneConnectionContext";

// Define route types and their parameters for autocomplete and type safety
export type RootStackParamList = {
  Login: undefined;
  Dashboard: { token: string; serverUrl: string };
  Connection: { token: string; serverUrl: string };
  Clients: { token: string; serverUrl: string };
  ClientDashboard: { clientId: string; token: string; serverUrl: string };
  Stats: { token: string; serverUrl: string };
  AdminDashboard: { token: string; serverUrl: string };
  Validation: { receiptId: string; serverUrl: string; token: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [savedSession, setSavedSession] = useState<{
    token: string;
    serverUrl: string;
  } | null>(null);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("Login");

  // Check localStorage and user role on mount to decide the correct entry screen
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("contaflow_token");
      const serverUrl = localStorage.getItem("contaflow_server_url");
      if (token && serverUrl) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const profile = await res.json();
            setSavedSession({ token, serverUrl });
            setInitialRoute(profile.role === "admin" ? "AdminDashboard" : "Dashboard");
          } else {
            localStorage.removeItem("contaflow_token");
            localStorage.removeItem("contaflow_server_url");
          }
        } catch {
          localStorage.removeItem("contaflow_token");
          localStorage.removeItem("contaflow_server_url");
        }
      }
      setIsReady(true);
    };
    restoreSession();
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
    <PhoneConnectionProvider>
      <NavigationContainer>
        <Stack.Navigator
        initialRouteName={initialRoute}
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
        <Stack.Screen name="Connection" component={ConnectionScreen} />
        <Stack.Screen name="Clients" component={ClientsScreen} />
        <Stack.Screen name="ClientDashboard" component={ClientDashboardScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen
          name="AdminDashboard"
          component={AdminScreen}
          initialParams={savedSession ?? undefined}
        />
        <Stack.Screen name="Validation" component={ValidationScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PhoneConnectionProvider>
  );
}
