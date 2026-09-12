export default async function handler(req, res) {
  // 1. Gestione CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // 2. Parsing sicuro del body (per evitare req.body undefined su Vercel)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  } else if (!body) {
    // Parsing manuale dello stream se Vercel non ha popolato req.body
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawData = Buffer.concat(buffers).toString();
    try {
      body = JSON.parse(rawData);
    } catch (e) {
      body = {};
    }
  }

  const { 
    serviceType, 
    description, 
    level, 
    followers, 
    hours, 
    expenses, 
    distance, 
    travelCost, 
    nights, 
    hotelCost, 
    expensePayer 
  } = body;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata nelle Environment Variables su Vercel.' });
  }

  const promptText = `
Sei un Pricing Strategist esperto del MERCATO REALE ITALIANO per Freelance, Content Creator e PMI.
Fornisci una stima estremamente pragmatica, realistica e credibile.

DATI INPUT:
- Tipologia: ${serviceType || 'Freelance'}
- Descrizione Progetto: "${description || 'Non specificata'}"
- Livello Esperienza: ${level || 'Mid-Level'}
- Follower / Audience: ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours || 8}
- Spese materiali/extra: €${expenses || 0}
- Trasferta: ${distance || 0} km (Auto €${travelCost || 0}, Hotel €${hotelCost || 0}, Notti: ${nights || 0})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE' : 'A CARICO MIO'}

PARAMETRI DI MERCATO REALE ITALIANO:
1. CONTENT CREATOR / INFLUENCER:
   - Nano (1k-10k follower): 30€ - 80€ lordi a post/reel.
   - Micro (10k-50k follower): 100€ - 300€ lordi a post/reel.
   - Mid-Tier (50k-100k follower): 300€ - 700€ lordi a post/reel.
   - Macro (100k-500k follower): 800€ - 2.500€ lordi a post/reel.

2. FREELANCE DIGITALI (Design, Dev, Video, Copy):
   - Junior (1-2 anni): 15€ - 25€ / ora lordi.
   - Mid-Level (3-5 anni): 30€ - 45€ / ora lordi.
   - Senior (5+ anni): 50€ - 80€ / ora lordi.

3. CALCOLO NETTO STIMATO:
   - Considera una pressione media (tasse + INPS) del ~30-35% per calcolare il NETTO REALE.

Restituisci TASSATIVAMENTE ed ESCLUSIVAMENTE un JSON con questo schema:
{
  "grossRate": "450",
  "netRate": "300",
  "marketRangeGross": "400€ - 500€ Lordi",
  "marketRangeNet": "270€ - 340€ Netti",
  "justification": "Spiegazione sintetica basata sul mercato reale italiano.",
  "emailSubject": "Preventivo e Proposta Commerciale - [Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\nin merito alla sua richiesta..."
}
`;

  try {
    // End-point ufficiale REST v1beta usando il modello valido gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          response_mime_type: "application/json" // Forza la restituzione di JSON valido senza markdown
        }
      })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ 
        error: `Errore Gemini API (${apiResponse.status}): ${data.error?.message || 'Errore di sistema'}` 
      });
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: 'Nessun contenuto restituito dall\'IA.' });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(rawText);

    return res.status(200).json(parsedData);

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno Serverless: ' + error.message });
  }
}
