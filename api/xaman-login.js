const { XummSdk } = require('xumm-sdk');

// Initialize Xaman SDK using your credentials saved in Vercel
const sdk = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

module.exports = async (req, res) => {
    // 1. Enable CORS handling for cross-origin browser execution loops (Unity WebGL / Editors)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS pre-flight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. INTERCEPT ROUTE: Handle window closure from mobile redirects
    if (req.query.action === 'close') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Success</title></head>
            <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>Authorization Approved!</h2>
                <p>You can close this window and return to the game.</p>
                <script>window.close();</script>
            </body>
            </html>
        `);
    }

    // 3. POST ROUTE: Unity is requesting a new Sign-In QR Code Payload
    if (req.method === 'POST') {
        try {
            // Safely parse the incoming JSON payload from Unity
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            // Generate the payload via Xaman SDK
            const payload = await sdk.payload.create({
                TransactionType: 'SignIn',
                ...body?.txjson // Safely merge overrides if sent
            });

            // Return the full payload tracking object back to Unity
            return res.status(200).json(payload);
        } catch (error) {
            console.error("Xaman Payload Creation Error:", error);
            return res.status(500).json({ error: "Failed to create login payload", details: error.message });
        }
    }

    // 4. GET ROUTE: Unity is polling to check if the payload has been resolved/signed
    if (req.method === 'GET') {
        const { uuid } = req.query;

        if (!uuid) {
            return res.status(400).json({ error: "Missing payload UUID parameter." });
        }

        try {
            // Fetch the current status of this specific QR payload from Xaman
            const payloadStatus = await sdk.payload.get(uuid);

            // Structure the response so your Unity 'XamanStatusResponse' class can read it cleanly
            return res.status(200).json({
                resolved: payloadStatus?.meta?.resolved || false,
                rejected: payloadStatus?.meta?.signed === false && payloadStatus?.meta?.resolved === true,
                expired: payloadStatus?.meta?.expired || false,
                openedInApp: payloadStatus?.meta?.opened || false,
                account: payloadStatus?.response?.account || "",
                nftCount: 0, // Handled inside your Unity client code via XrplNftCounter
                debugCount: 0
            });
        } catch (error) {
            console.error("Xaman Polling Error:", error);
            return res.status(500).json({ error: "Failed to fetch payload status", details: error.message });
        }
    }

    // Fallback for unsupported HTTP methods
    return res.status(405).json({ error: "Method Not Allowed" });
};
