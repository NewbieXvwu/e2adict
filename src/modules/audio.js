import { SPEAKER_ICON_SVG, NETWORKING_ICON_SVG, PLAYING_ICON_SVG } from './ui.js';

export function handleAudioPlay(buttonEl) {
  const audioSrc = buttonEl.dataset.src;
  if (!audioSrc || buttonEl.dataset.state) return;

  const audio = new Audio(audioSrc);
  
  const resetState = () => {
    buttonEl.innerHTML = SPEAKER_ICON_SVG;
    delete buttonEl.dataset.state;
    audio.removeEventListener('canplaythrough', onCanPlayThrough);
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('error', onError);
  };
  
  const onCanPlayThrough = () => {
    buttonEl.dataset.state = 'playing';
    buttonEl.innerHTML = PLAYING_ICON_SVG;
    audio.play().catch(onError);
  };

  const onEnded = () => resetState();
  const onError = (err) => {
    console.error("Audio playback failed:", err);
    resetState();
  };

  buttonEl.dataset.state = 'networking';
  buttonEl.innerHTML = NETWORKING_ICON_SVG;
  
  audio.addEventListener('canplaythrough', onCanPlayThrough);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', onError);
}