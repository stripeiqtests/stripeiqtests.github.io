import { useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n';

export function QuestionImage({ url, alt }: { url: string; alt: string }) {
  const { lang } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const ru = lang === 'ru';
  if (failed) return <div role="alert" className="rounded-lg border border-amber-300 p-4 text-center">
    <p>{ru ? 'Не удалось загрузить иллюстрацию. Загрузите её перед ответом.' : 'The illustration could not load. Please load it before answering.'}</p>
    <button className="mt-2 text-indigo-700 underline" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{ru ? 'Повторить загрузку' : 'Retry image'}</button>
  </div>;
  return <>
    <button type="button" className="mx-auto block max-w-full rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-600" aria-label={ru ? `Увеличить: ${alt}` : `Enlarge: ${alt}`} onClick={() => { setZoom(1); dialog.current?.showModal(); }}>
      <img key={attempt} src={url} alt={alt} onError={() => setFailed(true)} className="mx-auto max-h-[32rem] max-w-full rounded-lg border border-gray-200 bg-white object-contain" />
      <span className="mt-1 block text-sm text-indigo-700 underline">{ru ? 'Нажмите, чтобы увеличить' : 'Tap to enlarge'}</span>
    </button>
    <dialog ref={dialog} aria-label={alt} className="m-auto w-[95vw] max-w-5xl rounded-xl bg-white p-4 backdrop:bg-black/60" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div><div className="mb-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">{ru ? 'Масштаб' : 'Zoom'}<input type="range" min="1" max="4" step="0.25" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
        <button autoFocus className="rounded-lg border px-3 py-2 text-indigo-800" onClick={() => dialog.current?.close()}>{ru ? 'Закрыть' : 'Close'}</button>
      </div><div className="max-h-[70vh] overflow-auto"><img src={url} alt={alt} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} /></div></div>
    </dialog>
  </>;
}
