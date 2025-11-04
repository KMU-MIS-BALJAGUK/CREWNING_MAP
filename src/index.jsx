// src/index.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ⬇️ [로그 추가] ⬇️
console.log("index.jsx: React 앱 마운트 시도...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("🔥 치명적 오류: public/index.html 파일에 id='root'인 div가 없습니다.");
} else {
  console.log("✅ 'root' 엘리먼트 찾음");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
// ⬆️ [로그 추가] ⬆️