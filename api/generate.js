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
    return res.status(500).json({ error: 'GEMINI_API_KEY non trovata nelle Environment Variables.' });
  }

  const promptText = `
Sei un Senior Business Advisor & Pricing Strategist per Freelance e Content Creator in Italia.
Devi calcolare un preventivo e una stima di mercato IPER-REALISTICA, basandoti sui dati di mercato correnti e su logiche di pricing stringenti.

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

REGOLE RIGIDE PER IL CALCOLO REALE:
1. SE SI TRATTA DI CREATOR / INFLUENCER / SPONSORIZZAZIONI:
   - APPLICA RIGOROSAMENTE LE SOGLIE DI MERCATO BASATE SUI FOLLOWER:
     * Nano (1k - 10k follower): Valore sponsorizzazione medio tra 50€ e 250€ per post/reel.
     * Micro (10k - 50k follower): Valore medio tra 200€ e 800€ per post/reel.
     * Mid-Tier (50k - 100k follower): Valore medio tra 800€ e 2.000€ per post/reel.
     * Macro (100k - 500k follower): Valore medio tra 2.000€ e 6.000€ per post/reel.
     * Mega (500k+ follower): Valore medio oltre i 6.000€ fino a oltre 15.000€.
   - NON paragonare MAI un profilo da 10k a uno da 100k. Il raggio di copertura (reach) e il CPM commerciale sono drasticamente diversi.

2. SE SI TRATTA DI SERVIZI FREELANCE TRADIZIONALI (Design, Sviluppo, Video, Copywriter):
   - Junior (1-2 anni): 20€ - 35€ / ora.
   - Mid-Level (3-5 anni): 40€ - 65€ / ora.
   - Senior / Specialist (5+ anni): 70€ - 120€+ / ora.

3. GESTIONE SPESE TRASFERTA:
   - Se "A CARICO DEL CLIENTE": Non sommare il costo di hotel/viaggio al totale dell'onorario professionale, ma indica chiaramente che sono a carico suo.
   - Se "A CARICO MIO": Ricalcola il totale includendo coperture e rimborsi allineati.

Restituisci SOLO ed ESCLUSIVAMENTE un oggetto JSON valido (senza blocchi \`\`\`json) con questo formato:
{
  "recommendedRate": "450",
  "marketRange": "400€ - 600€",
  "justification": "Spiegazione analitica e professionale di come è stato calcolato il prezzo basandosi sulle metriche di audience, ore e costi accessori.",
  "emailSubject": "Proposta Commerciale e Preventivo per [Progetto]",
  "emailBody": "Gentile [Nome Cliente],\\n\\nin allegato..."
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
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
