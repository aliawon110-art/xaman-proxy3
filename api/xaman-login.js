const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");

const apiKey = process.env.XAMAN_API_KEY;
const apiSecret = process.env.XAMAN_API_SECRET;

let sdk = null;
if (apiKey && apiSecret) {
    sdk = new XummSdk(apiKey, apiSecret);
} else {
    console.error("[XAMAN REJECTION] Environment keys are missing from the configuration console.");
}

// ---------------- NFT CHECK ----------------
async function checkNFTs(walletAddress) {
    const client = new xrpl.Client("wss://xrplcluster.com");
    await client.connect();

    try {
        const res = await client.request({
            command: "account_nfts",
            account: walletAddress,
        });

        const nfts = res.result.account_nfts || [];
        console.log("WALLET:", walletAddress, "COUNT:", nfts.length);

        return {
            debugCount: nfts.length,
           hasEnoughNfts: nfts.length >= 3  // Only allow 3 or more!
        };
    } catch (err) {
        console.error("NFT EXCEPTION:", err);
        return { debugCount: 0, hasEnoughNfts: false };
    } finally {
        try { await client.disconnect(); } catch (e) {}
    }
}

// ---------------- MAIN HANDLER ----------------
module.exports = async function handler(req, res) {
    // Force clean CORS properties for external WebGL access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    res.setHeader("Cache-Control", "no-store");

    try {
        if (!sdk) {
            throw new Error("Application API keys are missing or unconfigured inside the environment panel.");
        }

        // ---------------- CREATE SIGN IN PAYLOAD (POST) ----------------
        if (req.method === "POST") {
            console.log("[XAMAN PIPELINE] Triggering payload generation request...");

            // Run a rapid diagnostics check to verify API credentials
            try {
                const pingTest = await sdk.ping();
                console.log("[XAMAN DIAGNOSTICS] App Name linked to credentials:", pingTest.application.name);
            } catch (pingErr) {
                console.error("[XAMAN DIAGNOSTICS FAILURE] API Key pair rejected by Xaman platform:", pingErr.message);
                throw new Error("Invalid Developer App API keys. Check credentials inside the Xaman Developer Console.");
            }

            // Create payload utilizing proper transaction structures
            // Passing true as the second parameter forces the SDK to yield specific network errors
            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn"
                },
                options: {
                    submit: false // Ensures transaction is strictly used for authentication scoping
                }
            }, true);

            console.log("[XAMAN API RESPONSE]:", JSON.stringify(payload));

            if (!payload || !payload.uuid) {
                const apiErrorReason = (payload && payload.error) ? ` Platform Error: ${payload.error.message}` : "";
                throw new Error(`Xaman endpoint failed to generate an identity tracking reference.${apiErrorReason}`);
            }

            return res.status(200).json({
                uuid: payload.uuid,
                next: payload.next,
                error: null
            });
        }

        // ---------------- CHECK AUTHENTICATION STATUS (GET) ----------------
        if (req.method === "GET") {
            const uuid = req.query.uuid;
            if (!uuid) {
                return res.status(400).json({ resolved: false, error: "Missing identity sequence tracking parameter." });
            }

            const result = await sdk.payload.get(uuid);
            if (!result || !result.meta) {
                throw new Error("Target identity sequence verification timed out on platform server.");
            }

            if (!result.meta.resolved) {
                return res.status(200).json({ resolved: false, error: null });
            }

            if (!result.meta.signed) {
                return res.status(200).json({
                    resolved: true,
                    hasEnoughNfts: false,
                    debugCount: 0,
                    error: "Authentication signature rejected by remote wallet user."
                });
            }

            const wallet = result.response.account;
            const nft = await checkNFTs(wallet);

            return res.status(200).json({
                resolved: true,
                account: wallet,
                debugCount: nft.debugCount,
                hasEnoughNfts: nft.hasEnoughNfts,
                error: null
            });
        }

        return res.status(405).json({ error: "Method implementation pattern rejected." });

    } catch (e) {
        console.error("[CRITICAL BACKEND EXCEPTION]:", e.message);
        
        // Use an HTTP 200 payload wrapper to carry backend exception data safely to Unity
        return res.status(200).json({
            uuid: null,
            next: null,
            resolved: false,
            error: e.message || "An unhandled server execution fallback occurred."
        });
    }
};
