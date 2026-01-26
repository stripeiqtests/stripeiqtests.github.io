/**
 * Analytics utility for Google Analytics 4 and Meta Pixel
 */

// Type declarations for global analytics functions
declare global {
    interface Window {
        gtag: (...args: any[]) => void;
        fbq: (...args: any[]) => void;
        dataLayer: any[];
    }
}

// Replace with your actual IDs
export const GA_MEASUREMENT_ID = 'G-BNN1N9N1PT';
export const META_PIXEL_ID = 'XXXXXXXXXXXXXXXXX';

/**
 * Track an event to both GA4 and Meta Pixel
 */
export function trackEvent(
    eventName: string,
    params?: Record<string, any>,
    options?: {
        gaOnly?: boolean;
        metaOnly?: boolean;
        metaEventName?: string; // Custom Meta event name if different from GA
    }
) {
    const { gaOnly, metaOnly, metaEventName } = options || {};

    // GA4 tracking
    if (!metaOnly && typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, params);
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

        if (standardEvents.includes(fbEventName)) {
            window.fbq('track', fbEventName, params);
        } else {
            window.fbq('trackCustom', fbEventName, params);
        }
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
export function trackPurchase(
    testId: string,
    sessionId: string,
    priceInCents: number,
    currency: string = 'USD'
) {
    trackEvent('purchase', {
        transaction_id: sessionId,
        test_id: testId,
        value: priceInCents / 100,
        currency,
    }, {
        metaEventName: 'Purchase'
    });
}

/**
 * Track payment cancellation
 */
export function trackPaymentCancel(testId?: string) {
    trackEvent('payment_cancel', {
        test_id: testId,
    });
}
