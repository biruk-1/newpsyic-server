// const express = require('express');
// const router = express.Router();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// // Create payment sheet
// router.post('/create-payment-sheet', async (req, res) => {
//   try {
//     const { amount, currency = 'usd', payment_method_options, metadata } = req.body;
//     console.log('Received request:', { amount, currency, payment_method_options, metadata });

//     if (!amount || amount <= 0) {
//       throw new Error('Invalid amount provided');
//     }

//     // Create a customer
//     const customer = await stripe.customers.create({
//       metadata: {
//         integration_check: 'accept_a_payment',
//       },
//     });
//     console.log('Created customer:', customer.id);

//     // Create an ephemeral key for the customer
//     const ephemeralKey = await stripe.ephemeralKeys.create(
//       { customer: customer.id },
//       { apiVersion: '2023-10-16' }
//     );
//     console.log('Created ephemeral key');

//     // Configure payment intent parameters
//     const paymentIntentParams = {
//       amount,
//       currency,
//       customer: customer.id,
//       payment_method_options: {
//         card: {
//           setup_future_usage: 'off_session'
//         }
//       },
//       automatic_payment_methods: {
//         enabled: true,
//         allow_redirects: 'never'
//       },
//       metadata: {
//         integration_check: 'accept_a_payment',
//         platform: metadata?.platform || 'unknown'
//       }
//     };

//     // Create a payment intent with enhanced configuration
//     const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
//     console.log('Created payment intent:', paymentIntent.id);

//     res.json({
//       paymentIntent: paymentIntent.client_secret,
//       ephemeralKey: ephemeralKey.secret,
//       customer: customer.id,
//     });
//   } catch (error) {
//     console.error('Error creating payment sheet:', error);
//     res.status(500).json({
//       error: error.message,
//       details: error.type || 'unknown_error'
//     });
//   }
// });

// // Create subscription
// router.post('/create-subscription', async (req, res) => {
//   try {
//     const { priceId, payment_method_types, payment_method_options } = req.body;
//     console.log('Creating subscription for price:', priceId);
//     console.log('Payment method types:', payment_method_types);
//     console.log('Payment method options:', payment_method_options);

//     if (!priceId) {
//       throw new Error('Price ID is required');
//     }

//     // Create a customer
//     const customer = await stripe.customers.create({
//       metadata: {
//         integration_check: 'accept_a_payment',
//       },
//     });
//     console.log('Created customer:', customer.id);

//     // Create an ephemeral key for the customer
//     const ephemeralKey = await stripe.ephemeralKeys.create(
//       {
//         customer: customer.id,
//       },
//       {
//         apiVersion: '2023-10-16',
//       }
//     );
//     console.log('Created ephemeral key');

//     // Create a subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customer.id,
//       items: [{ price: priceId }],
//       payment_behavior: 'default_incomplete',
//       payment_settings: { 
//         save_default_payment_method: 'on_subscription',
//         payment_method_types,
//         payment_method_options
//       },
//       expand: ['latest_invoice.payment_intent'],
//     });
//     console.log('Created subscription:', subscription.id);

//     res.json({
//       subscriptionId: subscription.id,
//       clientSecret: subscription.latest_invoice.payment_intent.client_secret,
//       ephemeralKey: ephemeralKey.secret,
//       customer: customer.id,
//     });
//   } catch (error) {
//     console.error('Error creating subscription:', error);
//     console.error('Error details:', {
//       message: error.message,
//       type: error.type,
//       code: error.code,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
    
//     res.status(500).json({ 
//       error: error.message,
//       type: error.type,
//       code: error.code,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create payment sheet for one-time payments
router.post('/create-payment-sheet', async (req, res) => {
  try {
    const { amount, currency = 'usd', payment_method_options, metadata } = req.body;
    console.log('Received request:', { amount, currency, payment_method_options, metadata });

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Invalid amount provided; must be a positive integer');
    }

    const customer = await stripe.customers.create({
      metadata: {
        integration_check: 'accept_a_payment',
        ...metadata,
      },
    });
    console.log('Created customer:', customer.id);

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2023-10-16' }
    );
    console.log('Created ephemeral key');

    const paymentIntentParams = {
      amount,
      currency,
      customer: customer.id,
      payment_method_options: {
        card: {
          setup_future_usage: 'off_session',
          ...payment_method_options?.card,
        },
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        integration_check: 'accept_a_payment',
        platform: metadata?.platform || 'unknown',
        ...metadata,
      },
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    console.log('Created payment intent:', paymentIntent.id);

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.error('Error creating payment sheet:', error);
    res.status(500).json({
      error: error.message,
      details: error.type || 'unknown_error',
    });
  }
});

// Create subscription for recurring payments
router.post('/create-subscription', async (req, res) => {
  try {
    const { priceId, payment_method_types, payment_method_options, metadata } = req.body;
    console.log('Received request:', { priceId, payment_method_types, payment_method_options, metadata });

    if (!priceId) {
      throw new Error('Price ID is required');
    }

    const validatedPaymentMethodTypes = Array.isArray(payment_method_types) && payment_method_types.length > 0 
      ? payment_method_types 
      : ['card'];
    if (!validatedPaymentMethodTypes.includes('card')) {
      throw new Error('payment_method_types must include "card" for Apple Pay/Google Pay support');
    }
    console.log('Validated payment method types:', validatedPaymentMethodTypes);

    const customer = await stripe.customers.create({
      metadata: {
        integration_check: 'accept_a_payment',
        ...metadata,
      },
    });
    console.log('Created customer:', customer.id);

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2023-10-16' },
    );
    console.log('Created ephemeral key');

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: validatedPaymentMethodTypes,
        payment_method_options: {
          card: {
            ...payment_method_options?.card,
          },
        },
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ...metadata,
      },
    });
    console.log('Created subscription:', subscription.id);

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    res.status(500).json({
      error: error.message,
      type: error.type,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;