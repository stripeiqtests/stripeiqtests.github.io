import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Home } from './pages/Home';
import { Test } from './pages/Test';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentCancel } from './pages/PaymentCancel';
import { LanguageProvider } from './lib/i18n';
import { AdminProvider } from './lib/AdminContext';

// Lazy load heavy components
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Results = lazy(() => import('./pages/Results').then(m => ({ default: m.Results })));

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
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/:slug" element={<Test />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LanguageProvider>
    </AdminProvider>
  );
}

export default App;
