const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const v4 = require('uuid').v4
const { getCountryData } = require('./utils')
const open = require('open')

require('dotenv').config()

let API_URL

const ACCOUNT_CODE = process.env.ACCOUNT_CODE
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY
const PRIVATE_SECRET_KEY = process.env.PRIVATE_SECRET_KEY

const SERVER_PORT = 8080

let CUSTOMER_ID

const app = express()

app.use(express.json())
app.use('/static', express.static(path.join(__dirname, 'static')))

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages/index.html'))
})

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages/checkout.html'))
})

// API: public key
app.get('/public-api-key', (req, res) => {
  res.json({ publicApiKey: PUBLIC_API_KEY })
})

// API: create checkout session
app.post('/checkout/sessions', async (req, res) => {
  const country = req.query.country || 'CO'
  const price = req.query.price || '15'
  const plan = req.query.plan || 'moderato'

  // Use USD for all plans — amount in cents
  const amount = parseFloat(price)

  const response = await fetch(`${API_URL}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: ACCOUNT_CODE,
      merchant_order_id: 'KIMI-' + Date.now(),
      payment_description: `Kimi AI ${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
      country,
      customer_id: CUSTOMER_ID,
      amount: {
        currency: 'USD',
        value: amount,
      },
    }),
  }).then((resp) => resp.json())

  res.json(response)
})

// API: create payment
app.post('/payments', async (req, res) => {
  const { checkoutSession, oneTimeToken } = req.body
  const country = req.query.country || 'CO'
  const price = req.query.price || '15'
  const { documentNumber, documentType } = getCountryData(country)

  // USD amount in cents matching the checkout session
  const amount = parseFloat(price)

  const response = await fetch(`${API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'X-idempotency-key': v4(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Kimi AI Subscription Payment',
      account_id: ACCOUNT_CODE,
      merchant_order_id: 'KIMI-' + Date.now(),
      country,
      amount: {
        currency: 'USD',
        value: amount,
      },
      checkout: {
        session: checkoutSession,
      },
      customer_payer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'max.li@y.uno',
        document: {
          document_type: documentType,
          document_number: documentNumber,
        },
        id: CUSTOMER_ID,
        merchant_customer_id: 'kimi-user-001',
      },
      payment_method: {
        token: oneTimeToken,
        vaulted_token: null,
      },
    }),
  }).then((resp) => resp.json())

  res.json(response)
})

// API: get payment methods for checkout session
app.get('/payment-methods/:checkoutSession', async (req, res) => {
  const checkoutSession = req.params.checkoutSession
  const response = await fetch(
    `${API_URL}/v1/checkout/sessions/${checkoutSession}/payment-methods`,
    {
      method: 'GET',
      headers: {
        'public-api-key': PUBLIC_API_KEY,
        'private-secret-key': PRIVATE_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    }
  )
  const paymentMethods = await response.json()
  res.json(paymentMethods)
})

app.listen(SERVER_PORT, async () => {
  console.log(`Server started at http://localhost:${SERVER_PORT}`)

  API_URL = generateBaseUrlApi()
  CUSTOMER_ID = await createCustomer().then(({ id }) => id)
  console.log(`Customer created: ${CUSTOMER_ID}`)

  await open(`http://localhost:${SERVER_PORT}`)
})

const ApiKeyPrefixToEnvironmentSuffix = {
  dev: '-dev',
  staging: '-staging',
  sandbox: '-sandbox',
  prod: '',
}

const baseAPIurl = 'https://api_ENVIRONMENT_.y.uno'

function generateBaseUrlApi() {
  const [apiKeyPrefix] = PUBLIC_API_KEY.split('_')
  const environmentSuffix = ApiKeyPrefixToEnvironmentSuffix[apiKeyPrefix]
  return baseAPIurl.replace('_ENVIRONMENT_', environmentSuffix)
}

function createCustomer() {
  return fetch(`${API_URL}/v1/customers`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      country: 'CO',
      merchant_customer_id: Math.floor(Math.random() * 1000000).toString(),
      first_name: 'John',
      last_name: 'Doe',
      email: 'max.li@y.uno',
    }),
  }).then((resp) => resp.json())
}
