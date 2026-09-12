export default async function handler(req, res) {
  // Gestione Header CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight Request per CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // Estrazione dati dal Body della richiesta
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
    return res.status(500).json({ error: 'GEMINI_API_KEY non trovata nelle Environment Variables.' });
  }

  const promptText = `
Sei un Senior Business Advisor & Pricing Strategist per Freelance e Content Creator in Italia.
Devi calcolare un preventivo e una stima di mercato IPER-REALISTICA, basandoti sui dati reali del mercato italiano medio (non su tariffe di agenzie milanesi top-tier).

DATI RICEVUTI:
- Categoria Servizio: ${serviceType}
- Descrizione Dettagliata: "${description}"
- Livello Esperienza / Anzianità: ${level}
- Numero di Follower / Seguitissimo (se applicabile): ${followers ? followers : 'Non specificato / Non applicabile'}
- Ore di Lavoro Stimate (produzione + post): ${hours}
- Spese Materiali / Acquisti: €${expenses}
- Distanza Trasferta A/R: ${distance} km
- Costo Trasporto/Carburante: €${travelCost}
- Notti Pernottamento: ${nights}
- Costo Hotel: €${hotelCost}
- Chi paga le spese vive: ${expensePayer === 'client' ? 'A CARICO DEL CLIENTE (a piè di lista / dirette)' : 'A CARICO DEL FREELANCER (anticipate e incluse nel preventivo)'}

REGOLE RIGIDE PER IL CALCOLO REALE (MERCATO ITALIA):
1. SE SI TRATTA DI CREATOR / INFLUENCER / SPONSORIZZAZIONI:
   - APPLICA RIGOROSAMENTE LE SOGLIE REALI DI MERCATO PER POST/REEL:
     * Nano (1k - 10k follower): 30€ - 100€ (molto spesso cambio merce o budget d'ingresso).
     * Micro (10k - 50k follower): 100€ - 350€.
     * Mid-Tier (50k - 100k follower): 350€ - 800€.
     * Macro (100k - 500k follower): 800€ - 2.500€.
     * Mega (500k+ follower): 2.500€ - 6.000€+.
   - Modula in base all'engagement effettivo e alla nicchia (B2B o tech pagano di più del lifestyle).

2. SE SI TRATTA DI SERVIZI FREELANCE TRADIZIONALI (Design, Sviluppo, Video, Copywriter):
   - Junior (1-2 anni): 18€ - 28€ / ora.
   - Mid-Level (3-5 anni): 30€ - 45€ / ora.
   - Senior / Specialist (5+ anni): 50€ - 80€ / ora.

3. GESTIONE SPESE TRASFERTA:
   - Se "A CARICO DEL CLIENTE": Non sommare il costo di hotel/viaggio al totale dell'onorario professionale, ma indica chiaramente che sono a carico suo.
   - Se "A CARICO MIO": Ricalcola il totale includendo le spese anticipate e aggiungi un piccolo margine per il rischio finanziario.

Restituisci SOLO ed ESCLUSIVAMENTE un oggetto JSON valido con questo formato:
{
  "recommendedRate": "450",
  "marketRange": "400€ - 600€",
  "justification": "Spiegazione analitica e professionale di come è stato calcolato il prezzo basandosi sulle metriche di audience, ore e costi accessori.",
  "emailSubject": "Proposta Commerciale e Preventivo per [Progetto]",
  "emailBody": "Gentile [Nome Cliente],\\n\\nin allegato..."
}
`;

  try {
    // Chiamata all'API di Gemini 2.5 Flash
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
      return res.status(500).json({ 
        error: `Errore API Google (${response.status}): ${data.error?.message || 'Errore di sistema'}` 
      });
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: 'Risposta non valida dall\'IA.' });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}
