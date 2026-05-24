const { XummSdk } = require('xumm-sdk');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Explicitly using your active credentials to clear the 502 Bad Gateway crash
    const apiKey = "403506c7-97d3-4922-b45a-80a543decec1"; 
    const apiSecret = "5dfb5f42-5606-4fb3-b773-859a834c4d12"; 

    let sdk;
    try {
        sdk = new XummSdk(apiKey, apiSecret);
    } catch (sdkError) {
        return res.status(500).json({ error: "SDK Initialization Failure", details: sdkError.message });
    }

    // WEBGL STRICT POPUP HANDSHAKE
    if (req.query.action === 'close') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorized</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: sans-serif; text-align: center; padding-top: 60px; background-color: #121212; color: white; }
                </style>
            </head>
            <body>
                <h2>Authorization Approved!</h2>
                <p>Returning control to your game window...</p>
                <script>
                    if (window.opener) {
                        window.opener.postMessage("XAMAN_LOGIN_SUCCESS", "*");
                    }
                    setTimeout(function() { window.close(); }, 200);
                </script>
            </body>
            </html>
        `);
    }

    if (req.method === 'POST') {
        try {
            let payloadData = { 
                TransactionType: 'SignIn',
                options: {
                    return_url: {
                        app: `https://xaman-proxy3.vercel.app/api/xaman-login?action=close`,
                        web: `https://xaman-proxy3.vercel.app/api/xaman-login?action=close`
                    }
                }
            };
            
            if (req.body) {
                let parsedBody = req.body;
                if (typeof req.body === 'string') {
                    try { parsedBody = JSON.parse(req.body); } catch (e) {}
                }
                if (parsedBody && parsedBody.txjson) {
                    payloadData = { ...payloadData, ...parsedBody.txjson };
                } else if (parsedBody && typeof parsedBody === 'object') {
                    payloadData = { ...payloadData, ...parsedBody };
                }
            }

            const payload = await sdk.payload.create(payloadData);
            return res.status(200).json(payload);

        } catch (error) {
            return res.status(500).json({ error: "Failed to create login token", details: error.message });
        }
    }

    if (req.method === 'GET') {
        const { uuid } = req.query;
        if (!uuid) return res.status(400).json({ error: "Missing uuid parameter." });

        try {
            const payloadStatus = await sdk.payload.get(uuid);
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
            return res.status(500).json({ error: "Failed to pull session status", details: error.message });
        }
    }

    return res.status(405).json({ error: "Method Not Allowed" });
};
