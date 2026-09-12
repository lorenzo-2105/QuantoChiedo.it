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

  const { description, level, hours, expenses, distance, travelCost, nights, hotelCost, expensePayer } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non trovata nelle Environment Variables di Vercel.' });
  }

  const promptText = `
Sei un consulente ed esperto di pricing per freelance in Italia.
Analizza questo lavoro tenendo conto anche di trasferta, logistica, spese e di CHI PAGA i costi:
- Descrizione progetto: "${description}"
- Livello esperienziale: ${level}
- Ore di lavoro stimate: ${hours}
- Spese materiali/extra: €${expenses}
- Distanza trasferta: ${distance} km
- Costo totale trasporto/carburante: €${travelCost}
- Notti di pernottamento: ${nights}
- Costo totale pernottamento/hotel: €${hotelCost}
- Gestione Spese e Logistica: ${expensePayer === 'client' ? 'A CARICO DEL CLIENTE (prenotate/pagate direttamente dal cliente o a piè di lista)' : 'A CARICO MIO (anticipate da me e incluse nel preventivo)'}

Rispondi SOLO ed ESCLUSIVAMENTE con un oggetto JSON valido (senza formattazione Markdown, senza racchiuderlo in \`\`\`json) seguendo questa struttura:
{
  "recommendedRate": "35",
  "marketRange": "300€ - 500€",
  "justification": "Spiegazione breve in due frasi della stima, specificando come sono state considerate le spese di trasferta e pernottamento.",
  "emailSubject": "Preventivo per la realizzazione del progetto",
  "emailBody": "Gentile Cliente,\\n\\nIn merito alla sua richiesta..."
}

Istruzioni per l'e-mail:
Genera una proposta commerciale formale e altamente professionale.
- Se "expensePayer" è "freelancer" (a mio carico): includi e scorpora in dettaglio le spese nei costi del preventivo finale.
- Se "expensePayer" è "client" (a carico del cliente): mantieni il preventivo focalizzato sul solo compenso professionale e specifica chiaramente nell'e-mail una clausola formale in cui si indica che i costi di viaggio/hotel/spese vive restano a diretto carico del cliente (o da rimborsare a piè di lista previo accordo).
`;

  try {
    // Endpoint aggiornato al modello supportato gemini-3.6-flash
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
        error: `Errore Google Gemini API (${response.status}): ${data.error?.message || 'Chiave non valida o quota superata'}` 
      });
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: 'Risposta non valida da parte dell\'IA.' });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
  }
}
