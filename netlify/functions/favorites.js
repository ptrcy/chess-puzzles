// Store favorites in-memory (for demo) or use Netlify Blobs
const fs = require('fs').promises;
const path = require('path');

const FAVORITES_FILE = path.resolve(__dirname, 'favorites.json');

async function readFavorites() {
    try {
        const data = await fs.readFile(FAVORITES_FILE, 'utf8');
        return new Map(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return new Map();
        }
        throw error;
    }
}

async function writeFavorites(favoritesMap) {
    await fs.writeFile(FAVORITES_FILE, JSON.stringify(Array.from(favoritesMap.entries())), 'utf8');
}

exports.handler = async (event, context) => {
    // WARNING: This is a demo implementation for persistence using a local JSON file.
    // It is NOT production-ready. In a real application, you would use a database
    // like Netlify Blobs, FaunaDB, or a similar persistent storage solution.
    //
    // Also, this implementation lacks user authentication and authorization.
    // Any user can add, view, or delete any favorite. For a production application,
    // you MUST implement proper authentication (e.g., Netlify Identity) and
    // authorization to ensure users can only manage their own favorites.
    
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
        const favorites = await readFavorites();

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
            await writeFavorites(favorites);

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
            await writeFavorites(favorites);

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
