import { getCheckoutSession, createPayment, getPublicApiKey } from './api.js'

// Start API calls immediately in parallel with SDK load
const apiDataPromise = Promise.all([
  getCheckoutSession(),
  getPublicApiKey(),
])

async function initCheckout() {
  try {
    const [sessionData, publicApiKey] = await apiDataPromise
    const checkoutSession = sessionData.checkout_session
    const countryCode = sessionData.country

    const yuno = await Yuno.initialize(publicApiKey)

    const payButton = document.getElementById('button-pay')
    const loadingEl = document.getElementById('sdk-loading')
    let isPaying = false

    await yuno.startCheckout({
      checkoutSession,
      elementSelector: '#full-root',
      countryCode,
      language: 'en',
      showLoading: true,
      keepLoader: true,
      renderMode: {
        type: 'element',
        elementSelector: {
          apmForm: '#full-form-element',
          actionForm: '#full-action-form-element',
        },
      },
      card: {
        type: 'extends',
      },
      externalPaymentButtons: {
        paypal: {
          elementSelector: '#paypal',
        },
      },
      onLoading: (args) => {
        if (!isPaying && !args.isLoading) {
          loadingEl.style.display = 'none'
          payButton.disabled = false
        }
      },
      async yunoCreatePayment(oneTimeToken) {
        isPaying = true
        payButton.disabled = true
        payButton.textContent = 'PROCESSING...'

        await createPayment({ oneTimeToken, checkoutSession })
        yuno.continuePayment()
      },
      yunoPaymentMethodSelected(data) {
        console.log('Payment method selected:', data)
      },
      yunoPaymentResult(data) {
        console.log('Payment result:', data)
        yuno.hideLoader()
        showResult(data)
      },
      yunoError: (error) => {
        console.log('Yuno error:', error)
        yuno.hideLoader()
        payButton.disabled = false
        payButton.textContent = 'PLACE ORDER'
        isPaying = false
      },
    })

    yuno.mountCheckout()

    payButton.addEventListener('click', () => {
      yuno.startPayment()
    })

  } catch (err) {
    console.error('Init failed:', err)
    document.getElementById('sdk-loading').textContent = 'Failed to load payment methods. Please refresh.'
  }
}

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
  initCheckout()
} else {
  window.addEventListener('yuno-sdk-ready', initCheckout)
}
