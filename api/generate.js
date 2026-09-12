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
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata.' });
  }

  const promptText = `
Sei un Pricing Strategist esperto del MERCATO REALE ITALIANO per Freelance, Creator e PMI.
Fornisci una stima estremamente pragmatica, realistica e credibile (evita cifre gonfiate da agenzie milanesi di alto livello).

DATI INPUT:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello: ${level}
- Follower (se applicabile): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
- Spese materiali: €${expenses}
- Trasferta: ${distance} km (Auto €${travelCost}, Hotel €${hotelCost}, Notti: ${nights})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE (a piè di lista)' : 'A CARICO MIO (anticipate ed incluse nel totale)'}

PARAMETRI DI MERCATO REALE ITALIANO:
1. CONTENT CREATOR / INFLUENCER:
   - 1k-10k follower: 30€ - 80€ lordi a post/reel (molto spesso cambio merce o budget minimi).
   - 10k-50k follower: 100€ - 300€ lordi a post/reel.
   - 50k-100k follower: 300€ - 700€ lordi a post/reel.
   - 100k-500k follower: 800€ - 2.500€ lordi a post/reel.

2. FREELANCE DIGITALI (Design, Dev, Video, Copy):
   - Junior: 15€ - 25€ / ora lordi.
   - Mid-Level: 30€ - 45€ / ora lordi.
   - Senior: 50€ - 80€ / ora lordi.

3. CALCOLO NETTO STIMATO:
   - Considera una pressione media (tasse + INPS / gestione separata) del ~30-35% per calcolare il NETTO REALE che rimane in tasca.

Rispondi TASSATIVAMENTE con un oggetto JSON valido (senza blocchi \`\`\`json):
{
  "grossRate": "450",
  "netRate": "300",
  "marketRangeGross": "400€ - 500€ Lordi",
  "marketRangeNet": "270€ - 340€ Netti",
  "justification": "Spiegazione sintetica ed estremamente concreta basata sulla realtà di mercato italiana, evidenziando il distacco tra Lordo da preventivare e Netto in tasca.",
  "emailSubject": "Preventivo e Proposta Commerciale - [Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\nin merito alla sua richiesta..."
}
`;

  try {
    // MODELLO CORRETTO: gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Errore Gemini API: ${data.error?.message || 'Risposta HTTP errata dal provider'}` });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno: ' + error.message });
  }
}
