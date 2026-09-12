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
    hasExpenses,
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

  const expensesDetails = hasExpenses ? `
- Spese materiali/extra: €${expenses || 0}
- Trasferta: ${distance || 0} km (Auto €${travelCost || 0}, Hotel €${hotelCost || 0}, Notti: ${nights || 0})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE (a piè di lista)' : 'A CARICO MIO (anticipate ed incluse)'}
` : '- Spese vive/trasferte: Nessuna';

  const promptText = `
Sei un Commerciale e Pricing Strategist esperto del MERCATO REALE E PRAGMATICO ITALIANO (PMI, Piccole Imprese e Professionisti).
Il tuo obiettivo è generare un preventivo ad "Ancoraggio dei Prezzi" con cifre REALI, ACCESSIBILI e NON GONFIATE. I clienti italiani cercano prezzi giusti e trasparenti.

DATI INPUT:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello Esperienza: ${level}
- Follower (se Creator): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
${expensesDetails}

TARIFFE ORARIE DI RIFERIMENTO (SULLA BASE DEL MERCATO ITALIANO REALE):
- Junior: 12€ - 18€/ora netti (circa 18€ - 25€ lordi).
- Mid-Level: 20€ - 28€/ora netti (circa 28€ - 40€ lordi).
- Senior: 32€ - 45€/ora netti (circa 45€ - 65€ lordi).

CREATOR / UGC REALE ITALIANO:
- Nano (1k-10k): 25€ - 50€ a video/post.
- Micro (10k-50k): 60€ - 120€ a video/post.
- Mid (50k-100k): 150€ - 300€ a video/post.

STRUTTURA DEI 3 PACCHETTI (MANTIENI I PREZZI COMPRESSI E REALI):
1. BASE (Budget / Essenziale): Il prezzo d'ingresso. Onesto, senza fronzoli, copre solo il lavoro stretto e 1 revisione.
2. RECOMMENDED (Equilibrio / Consigliato): Il valore reale target (+25-30% rispetto al Base). Include file sorgente o 2 revisioni.
3. PREMIUM (Completo): Un piccolo upsell pratico (+40-50% rispetto al Base) con consegne veloci o extra utili, senza sparare cifre irrealistiche.

LOGICA NEGOZIAZIONE OBIEZIONI:
Genera 3 risposte veloci ed efficaci in italiano da inviare se il cliente chiede uno sconto:
1. "defense": Difesa del Valore (Prezzo già al minimo per garantire la qualità).
2. "descoping": Riduzione Deliverables (Taglio prezzo in cambio di meno lavorazione/revisioni).
3. "tradeoff": Vantaggio Liquidità (Sconto 10% solo se salda il 100% subito).

Rispondi TASSATIVAMENTE con un oggetto JSON valido (senza blocchi \`\`\`json):
{
  "tiers": {
    "base": {
      "name": "Essenziale (Budget)",
      "grossRate": "150",
      "netRate": "100",
      "features": ["Deliverable principale", "1 Round di revisione", "Consegna standard"]
    },
    "recommended": {
      "name": "Pro / Consigliato",
      "grossRate": "210",
      "netRate": "140",
      "features": ["Deliverable completo", "2 Round di revisione", "File sorgenti inclusi", "Supporto post-consegna"]
    },
    "premium": {
      "name": "Completo & Priority",
      "grossRate": "290",
      "netRate": "190",
      "features": ["Tutto il pacchetto Pro", "Consegna Prioritaria Express", "1 Formato/Variante extra"]
    }
  },
  "justification": "Spiegazione sintetica della strategia di prezzo accessibile basata sulle reali ore di lavoro.",
  "emailSubject": "Proposta di collaborazione per [Nome Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\necco le opzioni di collaborazione calibrate sul vostro progetto...\\n\\n1. Opzione Essenziale (€[Base]): ...\\n2. Opzione Consigliata (€[Rec]): ...\\n3. Opzione Premium (€[Prem]): ...\\n\\nResto a disposizione per qualsiasi chiarimento.",
  "objections": {
    "defense": "Il preventivo fornito è già calcolato sulle ore minime effettive per garantire un lavoro ben fatto. Non posso applicare un ulteriore sconto diretto senza intaccare la qualità del risultato finale.",
    "descoping": "Se il budget a disposizione è inferiore, possiamo tranquillamente passare all'Opzione Essenziale (riducendo le revisioni a 1 sola e mantenendo i soli file finali) per rientrare nella cifra desiderata.",
    "tradeoff": "Possiamo applicare uno sconto straordinario del 10% sull'Opzione Consigliata a condizione di concordare il saldo anticipato del 100% all'accettazione della proposta."
  }
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
      return res.status(500).json({ error: `Errore Gemini API: ${data.error?.message}` });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    return res.status(500).json({ error: 'Errore interno: ' + error.message });
  }
}
