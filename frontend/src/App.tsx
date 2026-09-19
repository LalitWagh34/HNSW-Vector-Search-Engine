import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ChatView } from "./components/ChatView";
import { DocumentView } from "./components/DocumentView";
import { EvalView } from "./components/EvalView";
import { fetchHealth } from "./api";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"chat" | "documents" | "eval">("chat");
  const [systemStatus, setSystemStatus] = useState<{ backend: any; agent: any }>({
    backend: null,
    agent: null
  });

  const checkStatus = async () => {
    const status = await fetchHealth();
    setSystemStatus(status);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemStatus={systemStatus}
      />

      <main style={{ flex: 1, padding: "24px 20px" }}>
        {activeTab === "chat" && <ChatView />}
        {activeTab === "documents" && <DocumentView />}
        {activeTab === "eval" && <EvalView />}
      </main>
    </div>
  );
};

export default App;
