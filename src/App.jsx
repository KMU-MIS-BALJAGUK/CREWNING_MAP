// src/App.jsx
import React from 'react';
import KakaoMap from './components/KakaoMap';

function App() {
  // ⬇️ [로그 추가] ⬇️
  console.log("App.jsx: App 컴포넌트 렌더링됨. KakaoMap을 불러옵니다.");
  // ⬆️ [로그 추가] ⬆️

  return (
    <div className="App" style={{ width: '100vw', height: '100vh' }}>
      <KakaoMap />
    </div>
  );
}

export default App;