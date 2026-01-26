import { ArrowRight, ArrowLeft, CheckCircle, XCircle, BarChart3, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../lib/i18n';

export function AdminPagesDashboard() {
    const { t, lang } = useLanguage();
    const location = useLocation();

    // Check if we're viewing a specific page preview
    const path = location.pathname;
    const isViewingSuccess = path.includes('/admin/pages/success');
    const isViewingCancel = path.includes('/admin/pages/cancel');
    const isViewingResults = path.includes('/admin/pages/results');
    const isViewingPaywall = path.includes('/admin/pages/paywall');
    const isViewingPreview = isViewingSuccess || isViewingCancel || isViewingResults || isViewingPaywall;

    // Map to actual page URLs
    const getIframeUrl = () => {
        if (isViewingSuccess) return '/payment/success?preview=admin&session_id=demo';
        if (isViewingCancel) return '/payment/cancel?preview=admin';
        if (isViewingResults) return '/results/preview?preview=admin';
        if (isViewingPaywall) return '/results/preview-paywall?preview=admin';
        return '';
    };

    const pages = [
        {
            id: 'success',
            titleKey: 'admin.payment_success',
            path: '/admin/pages/success',
            icon: CheckCircle,
            descriptionKey: 'admin.payment_success_desc',
            color: 'bg-green-50 text-green-600',
        },
        {
            id: 'cancel',
            titleKey: 'admin.payment_cancel',
            path: '/admin/pages/cancel',
            icon: XCircle,
            descriptionKey: 'admin.payment_cancel_desc',
            color: 'bg-red-50 text-red-600',
        },
        {
            id: 'paywall',
            titleKey: 'admin.paywall',
            path: '/admin/pages/paywall',
            icon: Lock,
            descriptionKey: 'admin.paywall_desc',
            color: 'bg-amber-50 text-amber-600',
        },
        {
            id: 'results',
            titleKey: 'admin.results_page',
            path: '/admin/pages/results',
            icon: BarChart3,
            descriptionKey: 'admin.results_page_desc',
            color: 'bg-purple-50 text-purple-600',
        },
    ];

    // If viewing a specific page preview, show iframe with back button
    if (isViewingPreview) {
        return (
            <div className="space-y-4">
                {/* Back button */}
                <Link
                    to="/admin/pages"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ru' ? 'Назад к страницам' : 'Back to Pages'}
                </Link>

                {/* Iframe container */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <iframe
                        src={getIframeUrl()}
                        className="w-full border-0"
                        style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}
                        title="Page Preview"
                    />
                </div>
            </div>
        );
    }

    // Default: show page cards
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('admin.page_content')}</h2>
                <p className="text-gray-500 mb-6">
                    {t('admin.view_pages_desc')}
                </p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pages.map((page) => (
                        <Link
                            key={page.id}
                            to={page.path}
                            className="group block bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-indigo-500 hover:shadow-md transition-all text-left"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${page.color} group-hover:scale-110 transition-transform`}>
                                    <page.icon className="w-6 h-6" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                                {t(page.titleKey)}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {t(page.descriptionKey)}
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
