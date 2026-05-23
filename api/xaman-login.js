const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");

// Gracefully handle missing environment variables so it doesn't crash initialization
const apiKey = process.env.XAMAN_API_KEY;
const apiSecret = process.env.XAMAN_API_SECRET;

let sdk = null;
if (apiKey && apiSecret) {
    sdk = new XummSdk(apiKey, apiSecret);
} else {
    console.error("CRITICAL CONFIG ERROR: XAMAN_API_KEY or XAMAN_API_SECRET is missing from environment variables.");
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

        console.log("WALLET:", walletAddress);
        console.log("NFT COUNT:", nfts.length);

        return {
            debugCount: nfts.length,
            hasEnoughNfts: nfts.length >= 2
        };

    } catch (err) {
        console.error("NFT ERROR:", err);
        return { debugCount: 0, hasEnoughNfts: false };
    } finally {
        try {
            await client.disconnect();
        } catch (e) {
            // Ignore disconnect errors
        }
    }
}

// ---------------- MAIN HANDLER ----------------
module.exports = async function handler(req, res) {

    // FIX CORS (VERY IMPORTANT FOR WEBGL)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    res.setHeader("Cache-Control", "no-store");

    try {
        // Fail early if SDK isn't configured properly
        if (!sdk) {
            throw new Error("Backend API keys are missing or unconfigured in Vercel.");
        }

        // ---------------- CREATE LOGIN (POST) ----------------
        if (req.method === "POST") {
            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn"
                }
            });

            if (!payload || !payload.uuid) {
                throw new Error("Xaman SDK failed to generate a valid auth payload.");
            }

            return res.status(200).json({
                uuid: payload.uuid,
                next: payload.next,
                error: null
            });
        }

        // ---------------- CHECK LOGIN (GET) ----------------
        if (req.method === "GET") {
            const uuid = req.query.uuid;

            if (!uuid) {
                return res.status(400).json({
                    resolved: false,
                    error: "Missing UUID"
                });
            }

            const result = await sdk.payload.get(uuid);

            if (!result || !result.meta) {
                throw new Error("Failed to retrieve payload details from Xaman.");
            }

            // not finished
            if (!result.meta.resolved) {
                return res.status(200).json({ resolved: false, error: null });
            }

            // rejected
            if (!result.meta.signed) {
                return res.status(200).json({
                    resolved: true,
                    hasEnoughNfts: false,
                    debugCount: 0,
                    error: "User rejected the sign-in request."
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

        return res.status(405).json({ error: "Method not allowed" });

    } catch (e) {
        console.error("SERVER EXCEPTION:", e.message);
        
        // Return a clean 200 JSON payload containing the error message 
        // This stops WebGL from blowing up on raw network crashes
        return res.status(200).json({
            uuid: null,
            next: null,
            resolved: false,
            error: e.message || "An unknown backend error occurred."
        });
    }
};
