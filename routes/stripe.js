const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log("Stripe Key:", process.env.STRIPE_SECRET_KEY);

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    console.log('Received payment intent request:', { amount, currency });

    // Validate amount is an integer
    if (!Number.isInteger(amount)) {
      return res.status(400).send({ error: 'Amount must be an integer in cents' });
    }
    if (amount <= 0) {
      return res.status(400).send({ error: 'Amount must be greater than zero' });
    }

    // Create a new customer for this payment
    const customer = await stripe.customers.create({
      description: 'Temporary customer for payment intent',
    });
    console.log('Created customer:', customer.id);

    // Create payment intent with the customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id, 
      payment_method_types: ['card', 'apple_pay', 'google_pay'],
    });
    console.log('Payment intent created:', paymentIntent.id);

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' }
    );

    res.send({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.error('Error in create-payment-intent:', error.message);
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;