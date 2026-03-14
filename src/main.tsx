// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css"; // 글로벌 스타일

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThemeProvider } from "@/components/common/ThemeProvider";

const queryClient = new QueryClient();

// Ordo에서 전달된 ?theme= 파라미터를 ThemeProvider 초기화 전에 altar-ui-theme 키로 저장
// → ThemeProvider가 처음부터 올바른 테마를 읽도록 보장
const _initParams = new URLSearchParams(window.location.search);
const _initTheme = _initParams.get('theme');
if (_initTheme === 'dark' || _initTheme === 'light' || _initTheme === 'system') {
  try { localStorage.setItem('altar-ui-theme', _initTheme); } catch { /* ignore */ }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="altar-ui-theme">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
