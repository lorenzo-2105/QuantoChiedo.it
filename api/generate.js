export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { description, level, hours, expenses } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key non configurata su Vercel' });
  }

  const prompt = `
Sei un consulente aziendale e pricing strategist senior per freelance.
Analizza questa richiesta di lavoro:
- Descrizione progetto: "${description}"
- Livello del professionista: ${level} (Junior / Mid-Level / Senior)
- Ore stimate: ${hours}
- Spese vive/materiali: €${expenses}

Fornisci una risposta esclusivamente in formato JSON con la seguente struttura esatta:
{
  "recommendedRate": "tariffa oraria consigliata in € (solo numero)",
  "marketRange": "forchetta di prezzo di mercato (es. 300€ - 500€)",
  "justification": "spiegazione di 2 frasi sul perché di questo prezzo in base al livello e al mercato",
  "emailSubject": "Oggetto professionale ed efficace per l'e-mail",
  "emailBody": "Testo dell'e-mail di proposta commerciale formale, persuasiva, orientata al valore e strutturata con: Saluto formale, riepilogo della comprensione del problema del cliente, proposta di soluzione, dettaglio dei costi (compenso professionale e rimborso spese scorporati), call to action per fissare una breve call conoscitiva. Non usare marcatori markdown nell'email."
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return res.status(200).json(JSON.parse(resultText));
  } catch (error) {
    return res.status(500).json({ error: 'Errore durante la generazione con l\'IA' });
  }
}
