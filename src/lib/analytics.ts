/**
 * Analytics utility for Google Analytics 4 and Meta Pixel
 */
import { readConsent } from './consent';

// Type declarations for global analytics functions
declare global {
    interface Window {
        gtag: (...args: unknown[]) => void;
        fbq: (...args: unknown[]) => void;
        dataLayer: unknown[];
    }
}

// Replace with your actual IDs
export const GA_MEASUREMENT_ID = 'G-BNN1N9N1PT';
export const META_PIXEL_ID = 'XXXXXXXXXXXXXXXXX';

export function initializeAnalytics() {
    if (readConsent() !== 'granted' || document.getElementById('optional-ga')) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => { window.dataLayer.push(args); };
    try {
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, {
            send_page_view: false,
            page_location: `${window.location.origin}/`,
            page_referrer: '',
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
        });
    } catch { return; /* Broken optional tracking must not break startup. */ }
    const script = document.createElement('script');
    script.id = 'optional-ga'; script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.append(script);
}

export function disableAnalytics() {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    document.getElementById('optional-ga')?.remove();
    for (const cookie of document.cookie.split(';')) {
        const name = cookie.trim().split('=')[0];
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', `;domain=${location.hostname}`, `;domain=.${location.hostname}`]) {
            document.cookie = `${name}=;max-age=0;path=/${domain};SameSite=Lax`;
        }
    }
}

/**
 * Track an event to both GA4 and Meta Pixel
 */
export function trackEvent(
    eventName: string,
    params?: Record<string, unknown>,
    options?: {
        gaOnly?: boolean;
        metaOnly?: boolean;
        metaEventName?: string; // Custom Meta event name if different from GA
    }
) {
    if (readConsent() !== 'granted') return;
    const { gaOnly, metaOnly, metaEventName } = options || {};

    // GA4 tracking
    if (!metaOnly && typeof window !== 'undefined' && window.gtag) {
        try { window.gtag('event', eventName, params); } catch { /* Optional analytics cannot block a test or checkout. */ }
    }

    // Meta Pixel tracking
    if (!gaOnly && typeof window !== 'undefined' && window.fbq) {
        const fbEventName = metaEventName || eventName;
        // Use standard events when applicable
        const standardEvents = [
            'PageView', 'ViewContent', 'Search', 'AddToCart', 'AddToWishlist',
            'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead',
            'CompleteRegistration', 'Contact', 'CustomizeProduct', 'Donate',
            'FindLocation', 'Schedule', 'StartTrial', 'SubmitApplication', 'Subscribe'
        ];

        try {
            if (standardEvents.includes(fbEventName)) window.fbq('track', fbEventName, params);
            else window.fbq('trackCustom', fbEventName, params);
        } catch { /* A blocked provider must not break the application. */ }
    }
}

// ============================================
// Predefined Analytics Events
// ============================================

/**
 * Track when a test starts
 */
export function trackTestStart(testId: string, testTitle: string) {
    trackEvent('test_start', {
        test_id: testId,
        test_title: testTitle,
        content_name: testTitle,
    }, {
        metaEventName: 'StartTrial'
    });
}

/**
 * Track when a test is completed
 */
export function trackTestComplete(testId: string, testTitle: string, questionCount: number) {
    trackEvent('test_complete', {
        test_id: testId,
        test_title: testTitle,
        content_name: testTitle,
        num_items: questionCount,
    }, {
        metaEventName: 'CompleteRegistration'
    });
}

/**
 * Track when user initiates checkout
 */
export function trackBeginCheckout(testId: string, priceInCents: number, currency: string = 'USD') {
    trackEvent('begin_checkout', {
        test_id: testId,
        value: priceInCents / 100,
        currency,
    }, {
        metaEventName: 'InitiateCheckout'
    });
}

/**
 * Track successful purchase
 */
const purchasesInThisTab=new Set<string>();
export async function trackPurchase(
    testId: string,
    priceInCents: number,
    currency: string = 'USD',
    checkoutId: string
) {
    if (readConsent() !== 'granted' || !checkoutId) return;
    // Stripe checkout IDs authorize verification: send only a one-way digest.
    let digest:ArrayBuffer;
    try { digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checkoutId)); }
    catch { return; /* Payment navigation must survive unavailable analytics crypto. */ }
    const transactionId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if(readConsent()!=='granted'||purchasesInThisTab.has(transactionId))return;
    try { if (sessionStorage.getItem(`purchase:${transactionId}`)) return; } catch { /* GA also deduplicates by ID. */ }
    purchasesInThisTab.add(transactionId);
    trackEvent('purchase', {
        transaction_id: transactionId,
        test_id: testId,
        value: priceInCents / 100,
        currency,
    }, {
        metaEventName: 'Purchase'
    });
    try { sessionStorage.setItem(`purchase:${transactionId}`, 'sent'); } catch { /* Optional deduplication. */ }
}

/**
 * Track payment cancellation
 */
export function trackPaymentCancel(testId?: string) {
    trackEvent('payment_cancel', {
        test_id: testId,
    });
}
