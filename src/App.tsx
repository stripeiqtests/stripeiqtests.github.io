import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Home } from './pages/Home';
import { LanguageProvider } from './lib/i18n';
import { AdminProvider } from './lib/AdminContext';
import { CookieConsent } from './components/CookieConsent';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SiteSettingsProvider } from './lib/siteSettings';
import {RouteMetadata} from './components/RouteMetadata';

// Lazy load heavy components
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Results = lazy(() => import('./pages/Results').then(m => ({ default: m.Results })));
const Test = lazy(() => import('./pages/Test').then(m => ({ default: m.Test })));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess').then(m => ({ default: m.PaymentSuccess })));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel').then(m => ({ default: m.PaymentCancel })));
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));

// Loading fallback component
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AdminProvider>
      <LanguageProvider>
        <SiteSettingsProvider>
        <BrowserRouter>
          <RouteMetadata />
          <CookieConsent />
          <ErrorBoundary><Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/:slug" element={<Test />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
            </Routes>
          </Suspense></ErrorBoundary>
        </BrowserRouter>
        </SiteSettingsProvider>
      </LanguageProvider>
    </AdminProvider>
  );
}

export default App;

