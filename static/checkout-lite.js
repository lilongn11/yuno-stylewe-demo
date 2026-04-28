import { getCheckoutSession, createPayment, getPublicApiKey } from './api.js'
import { runRiskAssessment } from './risk-assessment.js'

// Start API calls immediately in parallel with SDK load
const apiDataPromise = Promise.all([
  getCheckoutSession(),
  getPublicApiKey(),
])

let yuno = null
let checkoutSession = null
let currentMethod = null
let externalButtonsMounted = false

async function initCheckoutLite() {
  try {
    const [sessionData, publicApiKey] = await apiDataPromise
    checkoutSession = sessionData.checkout_session
    const countryCode = sessionData.country

    yuno = await Yuno.initialize(publicApiKey)

    await yuno.startCheckout({
      checkoutSession,
      elementSelector: '#lite-root',
      countryCode,
      language: 'en',
      showLoading: false,
      keepLoader: false,
      renderMode: {
        type: 'element',
        elementSelector: {
          apmForm: '#lite-form-element',
          actionForm: '#lite-action-form-element',
        },
      },
      card: {
        type: 'extends',
      },
      async yunoCreatePayment(oneTimeToken, tokenWithInformation) {
        try {
          await runRiskAssessment(oneTimeToken, tokenWithInformation)
        } catch (err) {
          console.warn('Risk check blocked the payment:', err)
          return
        }
        await createPayment({ oneTimeToken, checkoutSession })
        yuno.continuePayment()
      },
      yunoPaymentResult(data) {
        showResult(data)
      },
      yunoError: (error) => {
        console.log('Yuno error:', error)
      },
      onLoading: (args) => {
        if (!args.isLoading) {
          const cardArea = document.getElementById('card-sdk-area')
          cardArea.classList.add('loaded')
        }
      },
    })

    // Mount Card by default
    selectMethod('CARD')

  } catch (err) {
    console.error('Init failed:', err)
    document.getElementById('card-loading').textContent = 'Failed to load. Please refresh.'
  }
}

async function mountExternalButtonsOnce() {
  if (externalButtonsMounted) return
  externalButtonsMounted = true

  // Show both areas so the SDK can measure and render buttons
  document.getElementById('paypal-sdk-area').classList.add('open')
  document.getElementById('google-pay-sdk-area').classList.add('open')

  await yuno.mountExternalButtons([
    { paymentMethodType: 'PAYPAL', elementSelector: '#paypal-lite' },
    { paymentMethodType: 'GOOGLE_PAY', elementSelector: '#google-pay-lite' },
  ]).catch((err) => console.log('External buttons:', err))

  // Hide the one that's not currently selected
  if (currentMethod !== 'PAYPAL') {
    document.getElementById('paypal-sdk-area').classList.remove('open')
  }
  if (currentMethod !== 'GOOGLE_PAY') {
    document.getElementById('google-pay-sdk-area').classList.remove('open')
  }
}

function selectMethod(method) {
  currentMethod = method

  // Update radio selection + active state
  document.querySelectorAll('.sw-payment-option').forEach((opt) => {
    const isActive = opt.dataset.method === method
    opt.classList.toggle('active', isActive)
    opt.querySelector('input[type="radio"]').checked = isActive
  })

  // Show/hide SDK areas
  document.getElementById('card-sdk-area').classList.toggle('open', method === 'CARD')
  document.getElementById('paypal-sdk-area').classList.toggle('open', method === 'PAYPAL')
  document.getElementById('google-pay-sdk-area').classList.toggle('open', method === 'GOOGLE_PAY')

  if (method === 'CARD') {
    yuno.mountCheckoutLite({
      paymentMethodType: 'CARD',
      vaultedToken: null,
    })
  } else {
    // Lazy mount external buttons on first non-card selection
    mountExternalButtonsOnce()
  }
}

// Click handlers for payment options
document.querySelectorAll('.sw-payment-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    if (!yuno) return
    selectMethod(opt.dataset.method)
  })
})

function showResult(status) {
  const overlay = document.getElementById('payment-result')
  document.getElementById('result-icon').textContent =
    status === 'SUCCEEDED' ? '\u2705' : '\u26A0\uFE0F'
  document.getElementById('result-title').textContent =
    status === 'SUCCEEDED' ? 'Payment Successful!' : 'Payment ' + status
  document.getElementById('result-message').textContent =
    status === 'SUCCEEDED'
      ? 'Your StyleWe order has been placed successfully!'
      : 'Please try again or select a different payment method.'
  overlay.classList.add('visible')
}

if (typeof Yuno !== 'undefined') {
  initCheckoutLite()
} else {
  window.addEventListener('yuno-sdk-ready', initCheckoutLite)
}
