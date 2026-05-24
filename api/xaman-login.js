const { XummSdk } = require('xumm-sdk');

module.exports = async (req, res) => {
    // 1. Setup global CORS headers so Unity/WebGL can communicate smoothly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle pre-flight CORS requests instantly
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Retrieve environment variables
    const apiKey = process.env.XUMM_API_KEY || process.env.XUMM_APIKEY;
    const apiSecret = process.env.XUMM_API_SECRET || process.env.XUMM_APISECRET;

    // Direct fallback check if keys are completely missing
    if (!apiKey || !apiSecret) {
        console.error("CRITICAL ERROR: Xaman API Keys are missing in Vercel Environment Variables!");
        return res.status(500).json({ 
            error: "Backend configuration error: Missing API Keys.",
            suggestion: "Please add XUMM_API_KEY and XUMM_API_SECRET to your Vercel project environment variables."
        });
    }

    // Initialize the Xaman SDK safely inside the execution context
    let sdk;
    try {
        sdk = new XummSdk(apiKey, apiSecret);
    } catch (sdkError) {
        console.error("Failed to initialize XummSdk instance:", sdkError);
        return res.status(500).json({ error: "SDK Initialization Failure", details: sdkError.message });
    }

    // 3. Route Intercept: Close window handler for mobile deep-linking setups
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

    // 4. POST Pathway: Unity is creating a new login QR Code / Payload
    if (req.method === 'POST') {
        try {
            let payloadData = { TransactionType: 'SignIn' };
            
            // Safe Body Parsing: Handles raw strings from UnityWebRequest as well as auto-parsed objects
            if (req.body) {
                let parsedBody = req.body;
                if (typeof req.body === 'string') {
                    try {
                        parsedBody = JSON.parse(req.body);
                    } catch (parseError) {
                        console.warn("Body was a string but failed standard JSON parsing, evaluating fallback.");
                    }
                }
                
                // If Unity sent standard JSON wrapping 'txjson'
                if (parsedBody && parsedBody.txjson) {
                    payloadData = { ...payloadData, ...parsedBody.txjson };
                } else if (parsedBody && typeof parsedBody === 'object') {
                    // Fallback: If Unity sent raw transaction values directly at the root level
                    payloadData = { ...payloadData, ...parsedBody };
                }
            }

            // Create the sign-in payload on the XRP Ledger via Xaman API
            const payload = await sdk.payload.create(payloadData);
            return res.status(200).json(payload);

        } catch (error) {
            console.error("Xaman Payload Creation Crash:", error);
            return res.status(500).json({ error: "Failed to create login token", details: error.message });
        }
    }

    // 5. GET Pathway: Unity is checking (polling) if the user scanned the QR code
    if (req.method === 'GET') {
        const { uuid } = req.query;

        if (!uuid) {
            return res.status(400).json({ error: "Missing required payload 'uuid' parameter." });
        }

        try {
            const payloadStatus = await sdk.payload.get(uuid);

            // Respond back matching Unity's target structural class mapping exactly
            return res.status(200).json({
                resolved: payloadStatus?.meta?.resolved || false,
                rejected: payloadStatus?.meta?.signed === false && payloadStatus?.meta?.resolved === true,
                expired: payloadStatus?.meta?.expired || false,
                openedInApp: payloadStatus?.meta?.opened || false,
                account: payloadStatus?.response?.account || "",
                nftCount: 0, 
                debugCount: 0
            });

        } catch (error) {
            console.error("Xaman Status Polling Crash:", error);
            return res.status(500).json({ error: "Failed to pull session status", details: error.message });
        }
    }

    // Fallback if someone attempts a PUT, DELETE, etc.
    return res.status(405).json({ error: "Method Not Allowed" });
};
