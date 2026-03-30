import { getCheckoutSession, createPayment, getPublicApiKey } from './api.js'

const params = new URLSearchParams(window.location.search)
const planName = params.get('plan') || 'moderato'
const monthlyPrice = parseFloat(params.get('price') || '15')
const originalPrice = parseFloat(params.get('original') || params.get('price') || '15')
const cycle = params.get('cycle') || 'annually'

// Total = discounted monthly * 12 for annual, or full monthly price
const totalAmount = cycle === 'annually' ? monthlyPrice * 12 : monthlyPrice
const billingLabel = cycle === 'annually' ? 'Billed annually' : 'Billed monthly'

// Populate order summary
document.getElementById('plan-name').textContent =
  planName.charAt(0).toUpperCase() + planName.slice(1) + ' Plan'
document.getElementById('plan-price').textContent = `$${totalAmount}`
document.getElementById('plan-billing-label').textContent = billingLabel
document.getElementById('plan-monthly').textContent = `$${monthlyPrice} / mo`

// Show discount if annual pricing is cheaper than original
if (cycle === 'annually' && originalPrice > monthlyPrice) {
  const savedPerMonth = originalPrice - monthlyPrice
  const savedTotal = savedPerMonth * 12
  document.getElementById('plan-original-price').textContent = `$${originalPrice}`
  document.getElementById('plan-original-price').style.textDecoration = 'line-through'
  document.getElementById('plan-original-price').style.color = '#aeaeb2'
  document.getElementById('plan-original-price').style.marginRight = '6px'
  document.getElementById('discount-row').style.display = 'flex'
  document.getElementById('plan-discount').textContent = `-$${savedTotal} (save $${savedPerMonth}/mo)`
}

let yuno = null
let checkoutSession = null
let currentMethod = null

async function initCheckoutLite() {
  try {
    const { checkout_session, country: countryCode } = await getCheckoutSession(totalAmount)
    checkoutSession = checkout_session

    const publicApiKey = await getPublicApiKey()
    yuno = await Yuno.initialize(publicApiKey)

    await yuno.startCheckout({
      checkoutSession,
      elementSelector: '#root',
      countryCode,
      language: 'en',
      renderMode: {
        type: 'element',
        elementSelector: {
          apmForm: '#form-element',
          actionForm: '#action-form-element',
        },
      },
      card: {
        type: 'extends',
      },
      async yunoCreatePayment(oneTimeToken) {
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
          document.getElementById('sdk-form-wrapper').classList.add('loaded')
        }
      },
    })

    // Mount CARD by default
    selectMethod('CARD')

    // Mount external buttons (non-blocking)
    yuno.mountExternalButtons([
      { paymentMethodType: 'PAYPAL', elementSelector: '#paypal' },
      { paymentMethodType: 'GOOGLE_PAY', elementSelector: '#google-pay' },
    ]).catch((err) => console.log('External buttons:', err))

  } catch (err) {
    console.error('Init failed:', err)
  }
}

function selectMethod(method) {
  currentMethod = method

  // Update radio selection
  document.querySelectorAll('.payment-method-card').forEach((c) => {
    c.classList.toggle('selected', c.dataset.method === method)
  })

  const sdkForm = document.getElementById('sdk-form-wrapper')
  const paypalWrapper = document.getElementById('paypal-wrapper')
  const googlePayWrapper = document.getElementById('google-pay-wrapper')

  // Hide all form areas
  sdkForm.classList.remove('loaded')
  paypalWrapper.style.display = 'none'
  googlePayWrapper.style.display = 'none'

  if (method === 'CARD') {
    // SDK will add .loaded class via onLoading callback once form is ready
    yuno.mountCheckoutLite({
      paymentMethodType: 'CARD',
      vaultedToken: null,
    })
  } else if (method === 'PAYPAL') {
    paypalWrapper.style.display = 'block'
  } else if (method === 'GOOGLE_PAY') {
    googlePayWrapper.style.display = 'block'
  }
}

// Click handlers
document.querySelectorAll('.payment-method-card').forEach((card) => {
  card.addEventListener('click', () => {
    if (!yuno) return
    selectMethod(card.dataset.method)
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
      ? `Your ${planName} subscription is now active!`
      : 'Please try again.'
  overlay.classList.add('visible')
}

// Handle SDK ready — either already loaded or wait for event
if (typeof Yuno !== 'undefined') {
  initCheckoutLite()
} else {
  window.addEventListener('yuno-sdk-ready', initCheckoutLite)
}
