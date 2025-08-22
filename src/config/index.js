// Configuration management for Roastr.ai

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo',
  },
  perspective: {
    apiKey: process.env.PERSPECTIVE_API_KEY || '',
  },
  toxicity: {
    threshold: 0.7, // Toxicity threshold (0-1)
  },
  billing: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      // Stripe Price lookup keys for different plans
      priceLookupKeys: {
        free: process.env.STRIPE_PRICE_FREE_LOOKUP || 'roastr-free-v1',
        starter: process.env.STRIPE_PRICE_STARTER_LOOKUP || 'roastr-starter-v1',
        pro: process.env.STRIPE_PRICE_PRO_LOOKUP || 'roastr-pro-v1',
        plus: process.env.STRIPE_PRICE_PLUS_LOOKUP || 'roastr-plus-v1'
      },
      // URLs for checkout and portal
      successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/pricing',
      portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/billing'
    }
  },
};

module.exports = config;