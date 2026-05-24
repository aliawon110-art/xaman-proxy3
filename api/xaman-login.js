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
    // FIXED DIRECT KEY INJECTION
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

    // 3. STRICT INTERCEPT ROUTE: Aggressively closes window and switches back to Unity app
    if (req.query.action === 'close') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting to Game</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: sans-serif; text-align: center; padding-top: 60px; background-color: #000000; color: #ffffff; }
                    .spinner { border: 4px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #2196F3; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="spinner"></div>
                <h2>Authorization Successful!</h2>
                <p>Returning to your game window...</p>
                
                <script>
                    function enforceStrictReturn() {
                        // 1. Force the mobile system OS to wake up and focus your Unity App via custom protocol
                        window.location.replace("mygame://close");
                        
                        // 2. Strict desktop browser self-destruct sequence 
                        setTimeout(function() {
                            window.open('', '_self', ''); 
                            window.close();
                        }, 300);
                    }
                    window.onload = enforceStrictReturn;
                </script>
            </body>
            </html>
        `);
    }

    // 4. POST Pathway: Unity is creating a new login QR Code / Payload
    if (req.method === 'POST') {
        try {
            // Force Xaman to intercept the completion flow and hit our strict redirect routing handler
            let payloadData = { 
                TransactionType: 'SignIn',
                options: {
                    return_url: {
                        app: `https://xaman-proxy3.vercel.app/api/xaman-login?action=close`,
                        web: `https://xaman-proxy3.vercel.app/api/xaman-login?action=close`
                    }
                }
            };
            
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
                
                // Merge inbound elements if Unity sent custom payload objects inside 'txjson'
                if (parsedBody && parsedBody.txjson) {
                    payloadData = { ...payloadData, ...parsedBody.txjson };
                } else if (parsedBody && typeof parsedBody === 'object') {
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

    return res.status(405).json({ error: "Method Not Allowed" });
};
