import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SupportLink } from './SupportLink';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Do not log URLs, answers or result capabilities.
    console.error('Application render failed:', error.name, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const ru = document.documentElement.lang !== 'en';
    return <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-bold">{ru ? 'Не удалось показать страницу' : 'This page could not be displayed'}</h1>
      <p className="my-4">{ru ? 'Обновите страницу. Сохранённые ответы останутся в этом браузере.' : 'Reload the page. Saved answers will remain in this browser.'}</p>
      <button className="rounded-lg bg-indigo-600 px-5 py-3 text-white" onClick={() => window.location.reload()}>{ru ? 'Попробовать ещё раз' : 'Try again'}</button>
      <a className="ml-4 text-indigo-700 underline" href="/">{ru ? 'На главную' : 'Home'}</a>
      <p className="mt-6"><SupportLink /></p>
    </main>;
  }
}
