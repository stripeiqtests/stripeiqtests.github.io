import { loadStripe } from '@stripe/stripe-js';

// Stripe publishable key (safe to expose in frontend)
const stripePublishableKey = 'pk_test_51SshGBFIjOFz6lW0rLZxMPJqLQKZxMPJqLQKZxMPJqLQKZxMPJqLQKZxMPJqLQKZxMPJqLQKZxMPJqLQKZxMPJqLQK';

export const stripePromise = loadStripe(stripePublishableKey);

// Note: The secret key (sk_test_...) should NEVER be in frontend code
// It will be used in Supabase Edge Function for creating checkout sessions
