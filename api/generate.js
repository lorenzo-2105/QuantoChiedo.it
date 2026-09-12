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
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata nei Segreti di Vercel.' });
  }

  const expensesDetails = hasExpenses ? `
- Spese materiali/extra: €${expenses || 0}
- Trasferta: ${distance || 0} km (Auto €${travelCost || 0}, Hotel €${hotelCost || 0}, Notti: ${nights || 0})
- Gestione Spese: ${expensePayer === 'client' ? 'A CARICO CLIENTE (a piè di lista)' : 'A CARICO MIO (anticipate ed incluse)'}
` : '- Spese vive/trasferte: Nessuna';

  const promptText = `
Sei un Pricing Strategist esperto del MERCATO REALE ITALIANO per Freelancer, Videomaker e Content Creator / UGC.
Il tuo compito è calcolare un preventivo DINAMICO, proporzionato e di mercato per il progetto richiesto, basando le tue metriche su benchmark reali italiani.

BENCHMARK DI TARATURA DEL MERCATO ITALIANO:
Usa come punto di riferimento di mercato questo caso tipo: 
"Un Content Creator / Mid-Level da ~50k follower che realizza 1 Reel + 10 Storie o un lavoro di circa 5-7 ore si posiziona realisticamente nel range di ~300€ (Base) - ~450€ (Recommended) - ~600€ (Premium)".

REGOLE DI SCALABILITÀ E CALCOLO DINAMICO:
1. NON USARE CIFRE FISSE RIGIDE: adatta i prezzi in modo proporzionale in base al progetto reale:
   - Se le ore/lavorazioni richieste sono MENO del benchmark (es. solo 1-2 foto o 2 ore di editing), i prezzi scendono proporzionalmente.
   - Se le ore/lavorazioni richieste sono PIÙ del benchmark (es. 20 ore di dev o trasferta complessa), i prezzi salgono in modo coerente.
   - Scala in base ai follower se Creator/UGC (Nano <10k, Micro 10k-50k, Mid 50k-100k+).
   - Includi sempre eventuali spese di trasferta o extra inserite dall'utente.
2. Calcola sempre un netto stimato credibile (pari a circa il 60-65% del lordo, considerando le tasse italiane).

DATI INPUT PROGETTO ATTUALE:
- Tipologia: ${serviceType}
- Descrizione Progetto: "${description}"
- Livello Esperienza: ${level}
- Follower (se Creator): ${followers ? followers : 'N/A'}
- Ore lavoro stimate: ${hours}
${expensesDetails}

STRUTTURA DEI 3 PACCHETTI:
1. BASE (Essenziale): Minimo indispensabile di valore. 1 revisione inclusa, tempi standard.
2. RECOMMENDED (Consigliato): Soluzione ideale (+35-45% rispetto al Base). Include revisioni extra, file sorgenti e miglior rapporto qualità/prezzo.
3. PREMIUM (Completo & Express): Soluzione All-Inclusive (+70-90% rispetto al Base). Include consegne rapide priority, licenze d'uso estese o varianti.

Rispondi TASSATIVAMENTE con un oggetto JSON valido (senza blocchi \`\`\`json):
{
  "tiers": {
    "base": {
      "name": "Essenziale",
      "grossRate": "valore_lordo_calcolato",
      "netRate": "valore_netto_stimato",
      "features": ["Deliverable principale", "1 Round di revisione", "Consegna nei tempi standard"]
    },
    "recommended": {
      "name": "Pro / Consigliato",
      "grossRate": "valore_lordo_calcolato",
      "netRate": "valore_netto_stimato",
      "features": ["Deliverable completo", "2 Round di revisione", "File sorgenti pronti", "Assistenza post-consegna"]
    },
    "premium": {
      "name": "Completo & Priority",
      "grossRate": "valore_lordo_calcolato",
      "netRate": "valore_netto_stimato",
      "features": ["Tutto il pacchetto Pro", "Consegna Prioritaria Express", "Diritti d'uso commerciali estesi", "1 Format/Variante extra"]
    }
  },
  "justification": "Analisi motivata del prezzo calcolato in base alla scala del lavoro e ai benchmark di mercato.",
  "emailSubject": "Proposta di collaborazione e preventivo - [Nome Progetto]",
  "emailBody": "Gentile [Cliente],\\n\\necco le opzioni trasparenti pensate per la realizzazione del vostro progetto...\\n\\n1. Opzione Essenziale (€[Base]): ...\\n2. Opzione Consigliata (€[Rec]): ...\\n3. Opzione Premium (€[Prem]): ...\\n\\nResto a disposizione.",
  "objections": {
    "defense": "Il preventivo della versione Consigliata rispecchia il valore reale di mercato per la complessità richiesta e include tutte le lavorazioni necessarie per garantire il massimo livello qualitativo.",
    "descoping": "Se occorre rientrare in un budget inferiore, possiamo optare per l'Opzione Essenziale riducendo le revisioni a 1 sola e limitando la fornitura ai soli file finali.",
    "tradeoff": "Possiamo applicare uno sconto del 10% sulla versione Pro a condizione di concordare il saldo anticipato del 100% all'accettazione della proposta."
  }
}
`;

  // Utilizzo del modello ufficiale corretto: gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Funzione con Retry automatico in caso di Rate Limit (429)
  const fetchWithRetry = async (retries = 2, delay = 2000) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        const data = await response.json();

        if (response.status === 429 && i < retries) {
          // Attende prima di riprovare se supera il limite temporaneo
          await new Promise(res => setTimeout(res, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(data.error?.message || 'Errore nella chiamata a Gemini');
        }

        return data;
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(res => setTimeout(res, delay));
      }
    }
  };

  try {
    const data = await fetchWithRetry();
    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    return res.status(429).json({ 
      error: 'Il servizio sta ricevendo troppe richieste al secondo. Riprova tra 3 secondi.' 
    });
  }
}
