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

const SERVER_PORT = process.env.PORT || 8080

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

app.get('/checkout/lite', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages/checkout-lite.html'))
})

// API: public key
app.get('/public-api-key', (req, res) => {
  res.json({ publicApiKey: PUBLIC_API_KEY })
})

// API: create checkout session
app.post('/checkout/sessions', async (req, res) => {
  const country = req.query.country || 'US'
  await getCustomerId()

  const response = await fetch(`${API_URL}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: ACCOUNT_CODE,
      merchant_order_id: 'SW-' + Date.now(),
      payment_description: 'StyleWe Order - Urban Plain Mini Denim Skirt',
      country,
      customer_id: CUSTOMER_ID,
      amount: {
        currency: 'USD',
        value: 31.68,
      },
    }),
  }).then((resp) => resp.json())

  res.json(response)
})

// API: create payment
app.post('/payments', async (req, res) => {
  const { checkoutSession, oneTimeToken } = req.body
  const country = req.query.country || 'US'
  const { documentNumber, documentType } = getCountryData(country)

  const response = await fetch(`${API_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'public-api-key': PUBLIC_API_KEY,
      'private-secret-key': PRIVATE_SECRET_KEY,
      'X-idempotency-key': v4(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'StyleWe Order Payment',
      account_id: ACCOUNT_CODE,
      merchant_order_id: 'SW-' + Date.now(),
      country,
      amount: {
        currency: 'USD',
        value: 31.68,
      },
      checkout: {
        session: checkoutSession,
      },
      customer_payer: {
        first_name: 'Max',
        last_name: 'Li',
        email: 'max.li@y.uno',
        document: {
          document_type: documentType,
          document_number: documentNumber,
        },
        id: CUSTOMER_ID,
        merchant_customer_id: 'stylewe-user-001',
        shipping_address: {
          address_line_1: '16 Teston Rd',
          city: 'Jesup',
          state: 'GA',
          country: 'US',
          zip_code: '31546-1504',
        },
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

// Lazy customer creation
let customerPromise = null
function getCustomerId() {
  if (!customerPromise) {
    customerPromise = createCustomer().then(({ id }) => {
      console.log(`Customer created: ${id}`)
      CUSTOMER_ID = id
      return id
    })
  }
  return customerPromise
}

app.listen(SERVER_PORT, () => {
  console.log(`Server started at http://localhost:${SERVER_PORT}`)
  API_URL = generateBaseUrlApi()

  getCustomerId()

  if (process.env.NODE_ENV !== 'production') {
    open(`http://localhost:${SERVER_PORT}`)
  }
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
      country: 'US',
      merchant_customer_id: Math.floor(Math.random() * 1000000).toString(),
      first_name: 'Max',
      last_name: 'Li',
      email: 'max.li@y.uno',
    }),
  }).then((resp) => resp.json())
}
