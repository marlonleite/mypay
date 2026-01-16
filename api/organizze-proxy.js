/**
 * Vercel Serverless Function - Proxy para API do Organizze
 * Evita problemas de CORS ao fazer requisições do frontend
 */

export default async function handler(req, res) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { endpoint, email, apiKey } = req.body

  if (!endpoint || !email || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: endpoint, email, apiKey' })
  }

  const BASE_URL = 'https://api.organizze.com.br/rest/v2'

  try {
    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': `myPay Migration (${email})`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: `Organizze API error: ${response.status}`,
        message: errorText,
      })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message,
    })
  }
}
