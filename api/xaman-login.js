 const axios = require('axios');

module.exports = async (req, res) => {
    // Enable CORS headers so your Unity WebGL build can talk to this proxy
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle browser preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests from Unity
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Forward the sign-in request directly to the secure Xaman API
        const response = await axios.post('https://xumm.app/api/v1/platform/payload', req.body, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.XAMAN_API_KEY,      // Safely read from Vercel Environment Variables
                'X-API-Secret': process.env.XAMAN_API_SECRET // Safely read from Vercel Environment Variables
            }
        });

        // Return Xaman's response data (including the login URLs) back to Unity
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Xaman API Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            error: 'Failed to generate login payload', 
            details: error.response ? error.response.data : error.message 
        });
    }
};
