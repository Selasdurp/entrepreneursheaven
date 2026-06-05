// Notion API proxy — gebruikt de per-gebruiker OAuth token uit de request body.
// Geen gedeelde env vars nodig; elke gebruiker heeft zijn eigen Notion verbinding.

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const CATS = [
    { key: 'Ideeën',       emoji: '💡' },
    { key: 'Beslissingen', emoji: '✅' },
    { key: 'Actiepunten',  emoji: '⚡' },
    { key: 'Inzichten',    emoji: '🔍' },
    { key: 'Open vragen',  emoji: '❓' }
];

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS, body: '' };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ongeldig verzoek' }) };
    }

    const { title, goal, categories = {}, notionToken, parentId, parentType } = body;

    if (!notionToken) {
        return {
            statusCode: 401,
            headers: CORS,
            body: JSON.stringify({ error: 'Geen Notion verbinding. Koppel eerst je account via de app.' })
        };
    }

    // ── Bouw de paginainhoud op als Notion blocks ─────────────────────
    const blocks = [];

    if (goal) {
        blocks.push({
            object: 'block', type: 'callout',
            callout: {
                rich_text: [{ type: 'text', text: { content: `Sessiedoel: ${goal}` } }],
                icon: { type: 'emoji', emoji: '🎯' },
                color: 'purple_background'
            }
        });
        blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } });
    }

    for (const cat of CATS) {
        const items = categories[cat.key] || [];
        blocks.push({
            object: 'block', type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: `${cat.emoji}  ${cat.key}` } }],
                is_toggleable: false
            }
        });
        if (items.length === 0) {
            blocks.push({
                object: 'block', type: 'paragraph',
                paragraph: {
                    rich_text: [{
                        type: 'text', text: { content: '— geen —' },
                        annotations: { italic: true, color: 'gray' }
                    }]
                }
            });
        } else {
            for (const item of items) {
                blocks.push({
                    object: 'block', type: 'bulleted_list_item',
                    bulleted_list_item: { rich_text: [{ type: 'text', text: { content: item } }] }
                });
            }
        }
        blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } });
    }

    blocks.push({ object: 'block', type: 'divider', divider: {} });
    blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: {
            rich_text: [{
                type: 'text',
                text: { content: 'Gegenereerd door entrepreneursheaven.ai — powered by Claude AI' },
                annotations: { italic: true, color: 'gray' }
            }]
        }
    });

    // ── Bepaal de parent (database of pagina) ────────────────────────
    let parent;
    let properties;

    if (parentId && parentType === 'database') {
        // Pagina aanmaken in een database → gebruikt "Name" property als titel
        parent     = { database_id: parentId };
        properties = { Name: { title: [{ type: 'text', text: { content: title || 'Brainstorm notulen' } }] } };
    } else if (parentId) {
        // Subpagina aanmaken onder een gewone pagina → gebruikt "title" property
        parent     = { page_id: parentId };
        properties = { title: [{ type: 'text', text: { content: title || 'Brainstorm notulen' } }] };
    } else {
        return {
            statusCode: 400,
            headers: CORS,
            body: JSON.stringify({ error: 'Geen Notion-locatie gevonden. Ontkoppel en verbind opnieuw, en deel een pagina of database.' })
        };
    }

    // ── Stuur naar Notion API ─────────────────────────────────────────
    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization':  `Bearer ${notionToken}`,
                'Content-Type':   'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent,
                icon: { type: 'emoji', emoji: '🎙️' },
                properties,
                children: blocks
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers: CORS,
                body: JSON.stringify({ error: result.message || `Notion API fout (${response.status})` })
            };
        }

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ url: result.url, id: result.id })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: err.message })
        };
    }
};
