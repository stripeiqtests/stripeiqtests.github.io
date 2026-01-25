import { ExternalLink, CheckCircle, XCircle, BarChart3 } from 'lucide-react';

export function AdminPagesDashboard() {

    const pages = [
        {
            id: 'success',
            title: 'Payment Success',
            path: '/payment/success?preview=admin&session_id=demo',
            icon: CheckCircle,
            description: 'Page shown after successful payment',
            color: 'bg-green-50 text-green-600',
        },
        {
            id: 'cancel',
            title: 'Payment Cancelled',
            path: '/payment/cancel',
            icon: XCircle,
            description: 'Page shown when payment is cancelled',
            color: 'bg-red-50 text-red-600',
        },
        {
            id: 'results',
            title: 'Results Page',
            path: '/results/preview?preview=admin',
            icon: BarChart3,
            description: 'Page showing test results after payment',
            color: 'bg-purple-50 text-purple-600',
        },
    ];

    const handleOpenPage = (path: string) => {
        // Get the base URL from current location
        const baseUrl = window.location.origin;
        window.open(baseUrl + path, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Page Content</h2>
                <p className="text-gray-500 mb-6">
                    Select a page to edit its content visually. The page will open in a new tab where you can click on text to edit it.
                </p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pages.map((page) => (
                        <button
                            key={page.id}
                            onClick={() => handleOpenPage(page.path)}
                            className="group block bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-indigo-500 hover:shadow-md transition-all text-left cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${page.color} group-hover:scale-110 transition-transform`}>
                                    <page.icon className="w-6 h-6" />
                                </div>
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                                {page.title}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {page.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

