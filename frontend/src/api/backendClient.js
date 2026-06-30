/**
 * Thin client for the FastAPI translator layer.
 *
 * The backend returns DiscountRule / CartItem objects in the exact shape
 * discountEngine.js expects — the engine itself is never aware of HTTP or PDFs.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function parseNaturalLanguageRule(text) {
  const res = await fetch(`${API_BASE}/api/parse-rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    throw new Error(`Rule parser unavailable (${res.status}). Is the backend running?`)
  }

  return res.json()
}

export async function parsePdfCart(file) {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}/api/parse-pdf-cart`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(`PDF parser unavailable (${res.status}). Is the backend running?`)
  }

  return res.json()
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
