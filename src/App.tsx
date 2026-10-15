import React, { useCallback, useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { I18nProvider } from './i18n/I18nContext';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';

const AppRouter: React.FC = () => {
  const { room } = useGame();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  return (
    <>
      {!room ? (
        <HomeScreen onToast={showToast} />
      ) : room.phase === 'lobby' ? (
        <LobbyScreen onToast={showToast} />
      ) : (
        <GameScreen onToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[3000] -translate-x-1/2 rounded-full border border-[#2AFF9A]/40 bg-[#152018]/95 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
          {toast}
        </div>
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <GameProvider>
        <AppRouter />
      </GameProvider>
    </I18nProvider>
  );
};

export default App;
