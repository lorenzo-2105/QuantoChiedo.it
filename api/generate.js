export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { 
    serviceType = '', 
    description = '', 
    level = '', 
    followers = '', 
    hours = 0, 
    expenses = 0, 
    distance = 0, 
    travelCost = 0, 
    nights = 0, 
    hotelCost = 0, 
    expensePayer = '' 
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata nelle Environment Variables.' });
  }

  const promptText = `
Sei un Pricing Strategist esperto del MERCATO REALE ITALIANO per Freelance, Content Creator e PMI.
Fornisci una stima estremamente pragmatica, realistica e credibile (evita cifre teoriche o gonfiate da agenzie milanesi di alto livello).

DATI INPUT:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello Esperienza: ${level}
- Follower / Audience (se applicabile): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
- Spese materiali/extra: €${expenses}
- Trasferta: ${distance} km (Auto/Mezzi €${travelCost}, Hotel €${hotelCost}, Notti: ${nights})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE (a piè di lista / gestite dal cliente)' : 'A CARICO MIO (anticipate ed incluse nel totale)'}

PARAMETRI DI MERCATO REALE ITALIANO:
1. CONTENT CREATOR / INFLUENCER:
   - Nano (1k-10k follower): 30€ - 80€ lordi a post/reel (molto spesso cambio merce o budget minimi).
   - Micro (10k-50k follower): 100€ - 300€ lordi a post/reel.
   - Mid-Tier (50k-100k follower): 300€ - 700€ lordi a post/reel.
   - Macro (100k-500k follower): 800€ - 2.500€ lordi a post/reel.

2. FREELANCE DIGITALI (Design, Dev, Video, Copy):
   - Junior (1-2 anni): 15€ - 25€ / ora lordi.
   - Mid-Level (3-5 anni): 30€ - 45€ / ora lordi.
   - Senior (5+ anni): 50€ - 80€ / ora lordi.

3. CALCOLO NETTO STIMATO:
   - Considera una pressione media (tasse + INPS / gestione separata) del ~30-35% per calcolare il NETTO REALE che rimane in tasca.

Rispondi TASSATIVAMENTE con un oggetto JSON valido con questo schema:
{
  "grossRate": "450",
  "netRate": "300",
  "marketRangeGross": "400€ - 500€ Lordi",
  "marketRangeNet": "270€ - 340€ Netti",
  "justification": "Spiegazione sintetica ed estremamente concreta basata sulla realtà di mercato italiana.",
  "emailSubject": "Preventivo e Proposta Commerciale - [Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\nin merito alla sua richiesta..."
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          response_mime_type: "application/json" // Istruisce l'API a restituire JSON puro
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Errore Gemini API (${response.status}): ${data.error?.message || 'Errore di sistema'}` 
      });
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: 'Risposta non valida dall\'IA.' });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    
    // Tentativo di parsing sicuro
    let jsonOutput;
    try {
      jsonOutput = JSON.parse(rawText);
    } catch (parseErr) {
      // Clean fallback in caso di frammenti di formattazione residue
      const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      jsonOutput = JSON.parse(cleanedText);
    }

    return res.status(200).json(jsonOutput);

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}
