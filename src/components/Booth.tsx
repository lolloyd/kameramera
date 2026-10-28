'use client';

import { useBooth } from '@/store/booth';
import StartScreen from './StartScreen';
import CaptureScreen from './CaptureScreen';
import ReviewScreen from './ReviewScreen';
import ResultScreen from './ResultScreen';

export default function Booth() {
  const screen = useBooth((s) => s.screen);

  return (
    <>
      {screen === 'start' && <StartScreen />}
      {screen === 'capture' && <CaptureScreen />}
      {screen === 'review' && <ReviewScreen />}
      {screen === 'result' && <ResultScreen />}
    </>
  );
}
