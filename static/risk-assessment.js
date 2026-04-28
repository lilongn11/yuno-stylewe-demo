// Demo-only risk assessment step.
// In production this is where the merchant calls their own risk/fraud
// provider (Sift, Forter, Riskified, Signifyd, an internal model, etc.)
// with the OTT and tokenWithInformation before authorizing the payment
// server-side. The OTT callback is the right hook because the SDK has
// already produced enriched, non-PCI signals the risk service can score.
//
// This implementation does NOT call any third party — it logs what would
// be sent and returns an APPROVE decision after a short simulated delay.

function maskToken(token) {
  if (typeof token !== 'string' || token.length < 12) return '***'
  return token.slice(0, 6) + '...' + token.slice(-4)
}

function buildRiskPayload(oneTimeToken, tokenWithInformation) {
  const info = tokenWithInformation || {}
  const card = info.card_data || {}

  // Note: card fingerprint is intentionally not included here. The Web SDK's
  // tokenWithInformation does not expose card_data.fingerprint — it lives on
  // the Payment Method object and must be fetched server-side via Yuno's API.

  return {
    oneTimeToken: maskToken(oneTimeToken),
    paymentType: info.type,
    vaultOnSuccess: info.vault_on_success,
    card: card.brand
      ? {
          brand: card.brand,
          iin: card.iin,
          lastFour: card.lfd,
          issuer: card.issuer_name,
          category: card.category,
          type: card.type,
        }
      : undefined,
    installment: info.installment
      ? {
          plan: info.installment.value,
          amount: info.installment.amount,
        }
      : undefined,
    context: {
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    },
  }
}

export async function runRiskAssessment(oneTimeToken, tokenWithInformation) {
  const payload = buildRiskPayload(oneTimeToken, tokenWithInformation)

  console.groupCollapsed(
    '%c[Risk Assessment] Pre-payment check',
    'color:#b45309;font-weight:bold',
  )
  console.log('Payload that would be sent to a risk provider:', payload)

  // Simulate the latency of a real risk service call.
  await new Promise((resolve) => setTimeout(resolve, 400))

  const decision = {
    action: 'APPROVE',
    score: 12,
    reasons: ['low_velocity', 'known_device', 'matched_billing_country'],
    provider: 'demo-risk-stub',
  }

  console.log('Decision:', decision)
  console.groupEnd()

  if (decision.action !== 'APPROVE') {
    throw new Error('Risk check declined: ' + decision.action)
  }

  return decision
}
