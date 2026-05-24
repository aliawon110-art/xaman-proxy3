const { XummSdk } = require('xumm-sdk');
const axios = require('axios'); // ADD THIS Stable HTTP module

// Initialize Xaman SDK using your credentials
const sdk = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

module.exports = async (req, res) => {
    // Enable CORS handling for cross-origin browser execution loops
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // INTERCEPT ROUTE: If the callback action tells the browser to close the window
    if (req.query.action === 'close') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Success</title>
                <style>
                    body { background-color: #121212; color: #ffffff; font-family: sans-serif; text-align: center; padding-top: 100px; }
                    .card { background: #1e1e1e; padding: 40px; display: inline-block; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                    h1 { color: #00e676; margin-bottom: 10px; }
                    p { color: #aaaaaa; font-size: 16px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>✓ Signed Successfully!</h1>
                    <p>Returning to your game screen automatically...</p>
                </div>
                <script>
                    // Execute tab shutdown protocols
                    setTimeout(function() {
                        window.close();
                        // Alternative path safety mechanism if native browser settings inhibit window close blocks
                        setTimeout(function() {
                            window.location.href = "about:blank";
                        }, 200);
                    }, 500);
                </script>
            </body>
            </html>
        `);
    }

    // PROCESS TIMELINE 1: Handle incoming POST requests to establish fresh validation signatures
    if (req.method === 'POST') {
        try {
            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn"
                },
                options: {
                    submit: false,
                    // FORCE REDIRECT: Returns the user back to our secure tab closing listener route
                    return_url: {
                        web: "https://xaman-proxy3.vercel.app/api/xaman-login?action=close"
                    }
                }
            }, true);

            return res.status(200).json({
                uuid: payload.uuid,
                next: { always: payload.next.always },
                refs: { qr_png: payload.refs.qr_png }
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // PROCESS TIMELINE 2: Handle incoming GET requests tracking user authorization state loops
    if (req.method === 'GET') {
        const { uuid } = req.query;
        if (!uuid) {
            return res.status(400).json({ error: "Missing required payload uuid parameter context." });
        }

        try {
            const status = await sdk.payload.get(uuid);
            
            let accountAddress = status.response?.account || null;
            let totalNftsFound = 0;

            // Fetch live data directly when authorization state updates successfully
            if (status.meta.resolved && accountAddress) {
                try {
                    // Pull verified ledger entries using stable axios instead of native fetch
                    const xrplResponse = await axios.post('https://xrplcluster.com/', {
                        method: "account_nfts",
                        params: [{ account: accountAddress, ledger_index: "validated" }]
                    }, {
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (xrplResponse.data && xrplResponse.data.result && xrplResponse.data.result.account_nfts) {
                        totalNftsFound = xrplResponse.data.result.account_nfts.length;
                    }
                } catch (rpcErr) {
                    console.error("RPC Lookup failed, fallback processing active:", rpcErr.message);
                }
            }

            return res.status(200).json({
                resolved: status.meta.resolved,
                rejected: status.meta.rejected,
                expired: status.meta.expired,
                openedInApp: status.meta.opened,
                account: accountAddress,
                nftCount: totalNftsFound,
                hasEnoughNfts: totalNftsFound >= 3
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: "Method implementation protocol mismatch error." });
};
