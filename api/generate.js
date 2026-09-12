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

  const { description, level, hours, expenses, distance, travelCost, nights, hotelCost } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non trovata nelle Environment Variables di Vercel.' });
  }

  const promptText = `
Sei un consulente ed esperto di pricing per freelance in Italia.
Analizza questo lavoro tenendo conto anche di trasferta, logistica e pernottamenti:
- Descrizione progetto: "${description}"
- Livello esperienziale: ${level}
- Ore di lavoro stimate: ${hours}
- Spese materiali/extra: €${expenses}
- Distanza trasferta: ${distance} km
- Costo totale trasporto/chilometrico: €${travelCost}
- Notti di pernottamento: ${nights}
- Costo totale pernottamento/hotel: €${hotelCost}

Rispondi SOLO ed ESCLUSIVAMENTE con un oggetto JSON valido (senza formattazione Markdown, senza racchiuderlo in \`\`\`json) seguendo questa struttura:
{
  "recommendedRate": "35",
  "marketRange": "300€ - 500€",
  "justification": "Spiegazione breve in due frasi della stima, includendo la logistica.",
  "emailSubject": "Preventivo per la realizzazione del progetto",
  "emailBody": "Gentile Cliente,\\n\\nIn merito alla sua richiesta..."
}

Istruzioni per l'e-mail:
Genera una proposta commerciale formale e altamente professionale. Se sono presenti spese di trasferta o pernottamento, trasparenza totale: scorpora in modo dettagliato nell'e-mail il compenso professionale, i costi di trasporto/rimborso chilometrico e le spese di alloggio.
`;

  try {
    // Endpoint aggiornato a gemini-2.0-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
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
