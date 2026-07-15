import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Text, View, StyleSheet } from "react-native";

type PhoneConnectionContextValue = {
  phoneConnected: boolean;
};

const PhoneConnectionContext = createContext<PhoneConnectionContextValue>({
  phoneConnected: false,
});

type Props = {
  children: React.ReactNode;
};

export function PhoneConnectionProvider({ children }: Props) {
  const [session, setSession] = useState({
    token: localStorage.getItem("contaflow_token"),
    serverUrl: localStorage.getItem("contaflow_server_url"),
  });
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [showDisconnectNotice, setShowDisconnectNotice] = useState(false);
  const wasPhoneConnected = useRef(false);

  useEffect(() => {
    const syncSession = () => {
      const token = localStorage.getItem("contaflow_token");
      const serverUrl = localStorage.getItem("contaflow_server_url");
      setSession((current) =>
        current.token === token && current.serverUrl === serverUrl
          ? current
          : { token, serverUrl },
      );
    };

    const interval = setInterval(syncSession, 500);
    window.addEventListener("storage", syncSession);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    const { token, serverUrl } = session;
    if (!token || !serverUrl) {
      setPhoneConnected(false);
      wasPhoneConnected.current = false;
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      ws = new WebSocket(
        `${serverUrl.replace(/^http/, "ws")}/ws?role=web&token=${encodeURIComponent(token)}`,
      );

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type !== "status") return;

          const isConnected = Boolean(message.phone_connected);
          if (wasPhoneConnected.current && !isConnected) {
            setShowDisconnectNotice(true);
          }
          wasPhoneConnected.current = isConnected;
          setPhoneConnected(isConnected);
        } catch {
          // Ignore malformed messages.
        }
      };

      ws.onclose = () => {
        if (active) reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [session]);

  useEffect(() => {
    if (!showDisconnectNotice) return;
    const timeout = setTimeout(() => setShowDisconnectNotice(false), 5000);
    return () => clearTimeout(timeout);
  }, [showDisconnectNotice]);

  return (
    <PhoneConnectionContext.Provider value={{ phoneConnected }}>
      {children}
      {showDisconnectNotice && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Telefon deconectat</Text>
          <Text style={styles.noticeText}>Conexiunea cu telefonul a fost pierdută.</Text>
        </View>
      )}
    </PhoneConnectionContext.Provider>
  );
}

export function usePhoneConnection() {
  return useContext(PhoneConnectionContext);
}

const styles = StyleSheet.create({
  notice: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 320,
  },
  noticeTitle: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  noticeText: {
    color: "#fee2e2",
    fontSize: 13,
  },
});
