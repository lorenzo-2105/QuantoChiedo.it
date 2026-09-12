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
Sei un Commerciale e Pricing Strategist per Freelancer e Creator in Italia.
Devi generare 3 pacchetti di prezzo ad ancoraggio ad un RANGE MEDIO ACCESSIBILE E MOLTO CONCRETO.

ANCHOR TARGET DI RIFERIMENTO (Per un lavoro standard da 4-8 ore):
- PACCHETTO BASE: ~300€ lordi (Netto st.: ~190€)
- PACCHETTO RECOMMENDED: ~450€ lordi (Netto st.: ~280€)
- PACCHETTO PREMIUM: ~600€ lordi (Netto st.: ~380€)

Adatta leggermente questi valori in base al numero effettivo di ore (${hours} ore) e all'esperienza (${level}), ma MANTIENI LA STRUTTURA DEL PREZZO ANCORATA ATTORNO A QUESTA SCALA (300€ - 450€ - 600€).

DATI INPUT:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello Esperienza: ${level}
- Follower (se Creator): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
${expensesDetails}

STRUTTURA PACCHETTI:
1. BASE (Essenziale): Il punto d'ingresso accessibile (Attorno a 300€). 1 revisione, cose essenziali.
2. RECOMMENDED (Pro / Consigliato): La scelta ideale (Attorno a 450€). File sorgente, 2 revisioni, supporto.
3. PREMIUM (Completo & Priority): Soluzione all-inclusive (Attorno a 600€). Consegna veloce, licenze uff. o varianti.

Rispondi TASSATIVAMENTE con un oggetto JSON valido (senza blocchi \`\`\`json):
{
  "tiers": {
    "base": {
      "name": "Essenziale",
      "grossRate": "300",
      "netRate": "190",
      "features": ["Deliverable principale", "1 Round di revisione", "Consegna nei tempi standard"]
    },
    "recommended": {
      "name": "Pro / Consigliato",
      "grossRate": "450",
      "netRate": "280",
      "features": ["Deliverable completo", "2 Round di revisione", "File sorgenti pronti", "Assistenza post-consegna"]
    },
    "premium": {
      "name": "Completo & Priority",
      "grossRate": "600",
      "netRate": "380",
      "features": ["Tutto il pacchetto Pro", "Consegna Prioritaria Express", "Diritti commerciali completi", "1 Variante formato extra"]
    }
  },
  "justification": "Strategia commerciale bilanciata sull'ancora di prezzo 300€ - 450€ - 600€, perfetta per PMI e professionisti.",
  "emailSubject": "Proposta di collaborazione e preventivo - [Nome Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\necco le 3 soluzioni pensate per la realizzazione del progetto...\\n\\n1. Opzione Essenziale (€[Base]): ...\\n2. Opzione Consigliata (€[Rec]): ...\\n3. Opzione Premium (€[Prem]): ...\\n\\nResto a disposizione.",
  "objections": {
    "defense": "L'opzione da 450€ è stata calcolata sulle ore effettive di lavorazione garantendo file pronti all'uso e revisioni incluse. È il miglior punto d'equilibrio per un lavoro professionale.",
    "descoping": "Se volete rimanere sui 300€ possiamo tranquillamente optare per la versione Essenziale, mantenendo il deliverable principale e riducendo a 1 sola revisione.",
    "tradeoff": "Possiamo concedere un 10% di sconto sulla versione Pro portandola a circa 400€ a fronte di un saldo immediato al momento della firma del preventivo."
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
