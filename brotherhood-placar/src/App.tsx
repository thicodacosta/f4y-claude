import { useEffect } from 'react';
import { ConfirmProvider } from './components/confirm';
import { displayWindowOpen } from './lib/browser';
import { isDisplayWindow, useRoute } from './lib/router';
import { sounds } from './lib/sound';
import { DisplayScreen } from './screens/DisplayScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { ScoreboardScreen } from './screens/ScoreboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { useAutoTransitions, useMatchSounds } from './state/effects';
import { useMatch, useSettings } from './state/store';

export function App() {
  const route = useRoute();
  const match = useMatch();
  const settings = useSettings();
  const popup = isDisplayWindow();

  useAutoTransitions(match, !popup);
  // Com o Telão aberto em outra janela, o som sai por lá (TV/caixa do ginásio).
  useMatchSounds(match, settings, popup || !displayWindowOpen());

  useEffect(() => {
    const unlock = () => sounds.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  let screen;
  switch (route.name) {
    case 'setup':
      screen = <SetupScreen />;
      break;
    case 'scoreboard':
      screen = <ScoreboardScreen />;
      break;
    case 'display':
      screen = <DisplayScreen popup={popup} />;
      break;
    case 'history':
      screen = <HistoryScreen />;
      break;
    case 'match':
      screen = <MatchDetailScreen id={route.id} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return <ConfirmProvider>{screen}</ConfirmProvider>;
}
