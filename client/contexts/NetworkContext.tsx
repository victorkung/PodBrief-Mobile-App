import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean | null;
  connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isConnected: null,
  connectionType: null,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
    });

    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
    });

    return () => unsubscribe();
  }, []);

  const isOnline = isConnected === true;

  return (
    <NetworkContext.Provider value={{ isOnline, isConnected, connectionType }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
