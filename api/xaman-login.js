const { XummSdk } = require('xumm-sdk');

module.exports = async (req, res) => {
    // 1. Setup global CORS headers so Unity/Webgl can communicate smoothly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight CORS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Safely initialize the Xaman SDK inside the function context
    const apiKey = process.env.XUMM_API_KEY || process.env.XUMM_APIKEY;
    const apiSecret = process.env.XUMM_API_SECRET || process.env.XUMM_APISECRET;

    if (!apiKey || !apiSecret) {
        console.error("CRITICAL ERROR: Xaman API Keys are missing in Vercel Environment Variables!");
        return res.status(500).json({ error: "Backend configuration error: Missing API Keys." });
    }

    const sdk = new XummSdk(apiKey, apiSecret);

    // 3. Route Intercept: Close window handler for mobile setups
    if (req.query.action === 'close') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Authorized</title></head>
            <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>Authorization Approved!</h2>
                <p>You can close this window and safely return to your game.</p>
                <script>window.close();</script>
            </body>
            </html>
        `);
    }

    // 4. POST Pathway: Unity is creating a new login QR Code
    if (req.method === 'POST') {
        try {
            // Safely parse the inbound string or object body from Unity
            let payloadData = { TransactionType: 'SignIn' };
            
            if (req.body) {
                const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                if (parsedBody.txjson) {
                    payloadData = { ...payloadData, ...parsedBody.txjson };
                }
            }

            // Create the payload on the XRP Ledger via Xaman
            const payload = await sdk.payload.create(payloadData);
            return res.status(200).json(payload);

        } catch (error) {
            console.error("Xaman Payload Creation Crash:", error);
            return res.status(500).json({ error: "Failed to create login token", details: error.message });
        }
    }

    // 5. GET Pathway: Unity is checking (polling) if the QR code was scanned
    if (req.method === 'GET') {
        const { uuid } = req.query;

        if (!uuid) {
            return res.status(400).json({ error: "Missing required payload uuid parameter." });
        }

        try {
            const payloadStatus = await sdk.payload.get(uuid);

            // Respond back matching Unity's 'XamanStatusResponse' mapping class
            return res.status(200).json({
                resolved: payloadStatus?.meta?.resolved || false,
                rejected: payloadStatus?.meta?.signed === false && payloadStatus?.meta?.resolved === true,
                expired: payloadStatus?.meta?.expired || false,
                openedInApp: payloadStatus?.meta?.opened || false,
                account: payloadStatus?.response?.account || "",
                nftCount: 0, // Calculated downstream on your Unity client side
                debugCount: 0
            });

        } catch (error) {
            console.error("Xaman Status Polling Crash:", error);
            return res.status(500).json({ error: "Failed to pull session status", details: error.message });
        }
    }

    return res.status(405).json({ error: "Method Not Allowed" });
};
