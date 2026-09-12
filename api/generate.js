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
- Spese materiali: €${expenses || 0}
- Trasferta: ${distance || 0} km (Auto €${travelCost || 0}, Hotel €${hotelCost || 0}, Notti: ${nights || 0})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE (a piè di lista)' : 'A CARICO MIO (anticipate ed incluse nel totale)'}
` : '- Spese vive/trasferte: Nessuna';

  const promptText = `
Sei un Pricing Strategist e Commerciale esperto del MERCATO REALE ITALIANO per Freelance, Creator e PMI.
Sulla base dei dati forniti, devi strutturare una proposta commerciale ad "Ancoraggio dei Prezzi" suddivisa in 3 PACCHETTI (Base, Consigliato, Premium) e generare 3 risposte tattiche di negoziazione per gestire le obiezioni sui prezzi.

DATI INPUT:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello: ${level}
- Follower (se applicabile): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
${expensesDetails}

PARAMETRI DI MERCATO REALE ITALIANO:
1. CONTENT CREATOR / INFLUENCER:
   - 1k-10k follower: 30€ - 80€ lordi a post/reel.
   - 10k-50k follower: 100€ - 300€ lordi a post/reel.
   - 50k-100k follower: 300€ - 700€ lordi a post/reel.
   - 100k-500k follower: 800€ - 2.500€ lordi a post/reel.

2. FREELANCE DIGITALI (Design, Dev, Video, Copy):
   - Junior: 15€ - 25€ / ora lordi.
   - Mid-Level: 30€ - 45€ / ora lordi.
   - Senior: 50€ - 80€ / ora lordi.

LOGICA DEI 3 TIER:
- BASE (Essenziale): Copre il lavoro minimo senza extra. 1 sola revisione.
- RECOMMENDED (Valore Ideale): Il prezzo target. Include 2 revisioni, file sorgente/formati extra.
- PREMIUM (Upsell): Prezzo alto (+40-60%). Consegna express, diritti d'uso estesi o varianti extra.

LOGICA NEGOZIAZIONE OBIEZIONI:
Fornisci 3 risposte pronte che il professionista può inviare se il cliente chiede uno sconto:
1. "defense": Difesa del Valore (Spiega perché la qualità e l'affidabilità non permettono sconti secchi).
2. "descoping": Riduzione Deliverables (Propone di scendere di prezzo riducendo il numero di revisioni, formati o tempi).
3. "tradeoff": Vantaggio Liquidità (Offre uno sconto es. 10% solo a fronte di saldo anticipato 100%).

Rispondi TASSATIVAMENTE con un oggetto JSON valido (senza blocchi \`\`\`json):
{
  "tiers": {
    "base": {
      "name": "Essenziale",
      "grossRate": "300",
      "netRate": "200",
      "features": ["Deliverable principale", "1 Round di revisione", "Consegna standard (10-14 gg)"]
    },
    "recommended": {
      "name": "Pro / Consigliato",
      "grossRate": "450",
      "netRate": "300",
      "features": ["Deliverables completi", "2 Round di revisione", "File sorgente inclusi", "Supporto 14 giorni post-consegna"]
    },
    "premium": {
      "name": "Full Pack & Priority",
      "grossRate": "750",
      "netRate": "500",
      "features": ["Tutto il pacchetto Pro", "Consegna Prioritaria Express", "Diritti d'uso commerciali estesi", "1 Formato/Variante extra integrata"]
    }
  },
  "justification": "Spiegazione sintetica della strategia di prezzo adottata nei tre pacchetti e dell'effetto ancòra per il cliente.",
  "emailSubject": "Proposta Commerciale e Opzioni di Collaborazione - [Nome Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\nin allegato le 3 opzioni di collaborazione pensate per le vostre esigenze:\\n\\n1. Opzione Essenziale (€[Base]): ...\\n2. Opzione Consigliata (€[Rec]): ...\\n3. Opzione Premium (€[Prem]): ...\\n\\nResto a disposizione per definire la scelta migliore.",
  "objections": {
    "defense": "Capisco l'attenzione al budget, ma la cifra rispecchia la qualità del lavoro e l'assenza di costi nascosti. Non posso applicare sconti sul prezzo senza intaccare la cura che dedicherò al progetto.",
    "descoping": "Se il budget attuale è limitato, possiamo ridurre l'investimento passando all'Opzione Essenziale (togliendo i file sorgente e riducendo le revisioni a 1 sola) per rientrare nella vostra cifra.",
    "tradeoff": "Posso concedere eccezionalmente uno sconto del 10% sull'Opzione Consigliata se concordiamo il saldo anticipato del 100% all'accettazione del preventivo."
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
