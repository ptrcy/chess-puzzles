// Store favorites in-memory (for demo) or use Netlify Blobs
const favorites = new Map();

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // GET - Retrieve favorites
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            let result = Array.from(favorites.values());
            
            // Filter by date if provided
            if (params.from || params.to) {
                result = result.filter(item => {
                    const itemDate = new Date(item.date);
                    if (params.from && itemDate < new Date(params.from)) return false;
                    if (params.to && itemDate > new Date(params.to)) return false;
                    return true;
                });
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        // POST - Add favorite
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            const id = data.id || generateId();
            
            favorites.set(id, {
                id: id,
                fen: data.fen,
                date: new Date().toISOString()
            });

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, id: id })
            };
        }

        // DELETE - Remove favorite
        if (event.httpMethod === 'DELETE') {
            const data = JSON.parse(event.body);
            const id = data.id;
            
            // Find and remove by FEN if ID not found
            if (!favorites.has(id)) {
                for (let [key, value] of favorites.entries()) {
                    if (value.fen === data.fen) {
                        favorites.delete(key);
                        break;
                    }
                }
            } else {
                favorites.delete(id);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
