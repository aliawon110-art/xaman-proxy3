const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");

const sdk = new XummSdk(
    process.env.XAMAN_API_KEY,
    process.env.XAMAN_API_SECRET
);

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
        client.disconnect();
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

        // ---------------- CREATE LOGIN ----------------
        if (req.method === "POST") {

            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn"
                }
            });

            return res.status(200).json({
                uuid: payload.uuid,
                next: payload.next
            });
        }

        // ---------------- CHECK LOGIN ----------------
        if (req.method === "GET") {

            const uuid = req.query.uuid;

            if (!uuid) {
                return res.status(400).json({
                    resolved: false,
                    error: "Missing UUID"
                });
            }

            const result = await sdk.payload.get(uuid);

            // not finished
            if (!result.meta.resolved) {
                return res.json({ resolved: false });
            }

            // rejected
            if (!result.meta.signed) {
                return res.json({
                    resolved: true,
                    hasEnoughNfts: false,
                    debugCount: 0
                });
            }

            const wallet = result.response.account;

            const nft = await checkNFTs(wallet);

            return res.json({
                resolved: true,
                account: wallet,
                debugCount: nft.debugCount,
                hasEnoughNfts: nft.hasEnoughNfts
            });
        }

        return res.status(405).json({ error: "Method not allowed" });

    } catch (e) {
        console.error(e);
        return res.status(500).json({
            resolved: false,
            error: e.message
        });
    }
};
