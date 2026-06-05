// Notion verbinding testen — geeft de paginanaam en type terug
// zodat de app kan bevestigen dat token + pagina-ID kloppen.

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS, body: '' };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ongeldig verzoek' }) }; }

    const { notionToken, pageId } = body;
    if (!notionToken || !pageId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Token of pagina-ID ontbreekt' }) };
    }

    // Probeer de pagina op te halen — dit valideert meteen token én toegang
    const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
            'Authorization':  `Bearer ${notionToken}`,
            'Notion-Version': '2022-06-28'
        }
    });
    const data = await resp.json();

    if (!resp.ok) {
        let msg = data.message || `Notion API fout (${resp.status})`;
        if (resp.status === 401) msg = 'Ongeldige token. Controleer of je de juiste "Internal Integration Secret" hebt gekopieerd.';
        if (resp.status === 404) msg = 'Pagina niet gevonden. Heb je de integratie wel gedeeld met deze pagina via "··· → Add connections"?';
        return { statusCode: resp.status, headers: CORS, body: JSON.stringify({ error: msg }) };
    }

    // Haal de paginanaam op (plain text)
    let title = 'Notion pagina';
    const titleProp = data.properties?.title || data.properties?.Name;
    if (titleProp?.title?.[0]?.plain_text) title = titleProp.title[0].plain_text;

    // Bepaal type: 'database' (als parent een database is) of 'page'
    const type = data.object === 'database' ? 'database' : 'page';

    return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ title, type })
    };
};
