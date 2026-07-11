import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ValidationScreen from "./src/screens/ValidationScreen";

// Define route types and their parameters for autocomplete and type safety
export type RootStackParamList = {
  Login: undefined; // No parameters expected
  Dashboard: { token: string; serverUrl: string }; // Requires token and server URL
  Validation: { receiptId: string; serverUrl: string; token: string }; // Requires receipt ID
};

// Create a Stack Navigator to manage a deck of stacked screens
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    // NavigationContainer manages the application state and links your top-level navigator
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false, // Hide the default native navigation top bar
        }}
      >
        {/* Application screens available in the stack */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Validation" component={ValidationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
