export async function getPublicApiKey() {
  return fetch('/public-api-key')
    .then(resp => resp.json())
    .then(resp => resp.publicApiKey)
}

export async function getCheckoutSession() {
  const params = new URLSearchParams(window.location.search)
  return fetch(`/checkout/sessions?${params.toString()}`, {
    method: 'POST',
  }).then(resp => resp.json())
}

export async function createPayment(data) {
  const params = new URLSearchParams(window.location.search)
  return fetch(`/payments?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  }).then(resp => resp.json())
}

export async function getPaymentMethods(checkoutSession) {
  return fetch(`/payment-methods/${checkoutSession}`)
    .then(resp => resp.json())
}
