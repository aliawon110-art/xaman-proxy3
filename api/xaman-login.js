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

    // ==========================================
    // EMERGENCY DIRECT KEY INJECTION (BYPASSES VERCEL ENV VARS)
    // ==========================================
    const apiKey = "403506c7-97d3-4922-b45a-80a543decec1"; 
    const apiSecret = "5dfb5f42-5606-4fb3-b773-859a834c4d12"; 
    // ==========================================

    // Initialize the Xaman SDK directly
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
                        console.warn("Body was a string but failed standard JSON parsing.");
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
