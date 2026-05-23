const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");

const sdk = new XummSdk(
    process.env.XAMAN_API_KEY,
    process.env.XAMAN_API_SECRET
);

async function checkNFTs(walletAddress) {

    const client = new xrpl.Client("wss://xrplcluster.com");

    await client.connect();

    try {

        const response = await client.request({
            command: "account_nfts",
            account: walletAddress,
        });

        const nfts = response.result.account_nfts || [];

        console.log("SIGNED WALLET:", walletAddress);
        console.log("NFT COUNT:", nfts.length);

        return {
            hasNFTs: nfts.length >= 2,
            debugCount: nfts.length,
        };

    } catch (err) {

        console.error("NFT ERROR:", err);

        return {
            hasNFTs: false,
            debugCount: 0,
        };

    } finally {

        client.disconnect();
    }
}

module.exports = async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    try {

        // ==================================================
        // CREATE LOGIN PAYLOAD
        // ==================================================

        if (req.method === "POST") {

            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn",
                },
            });

            return res.status(200).json({
                uuid: payload.uuid,
                next: {
                    always: payload.next.always,
                    no_qr: payload.next.no_qr,
                },
            });
        }

        // ==================================================
        // CHECK LOGIN STATUS
        // ==================================================

        if (req.method === "GET") {

            const uuid = req.query.uuid;

            if (!uuid) {
                return res.status(400).json({
                    resolved: false,
                    error: "Missing UUID",
                });
            }

            const result = await sdk.payload.get(uuid);

            console.log("XAMAN RESULT:", result);

            // NOT SIGNED YET
            if (!result.meta.resolved) {

                return res.status(200).json({
                    resolved: false,
                });
            }

            // USER REJECTED
            if (!result.meta.signed) {

                return res.status(200).json({
                    resolved: true,
                    hasNFTs: false,
                    debugCount: 0,
                });
            }

            // SUCCESS LOGIN
            const wallet = result.response.account;

            const nftResult = await checkNFTs(wallet);

            return res.status(200).json({
                resolved: true,
                hasNFTs: nftResult.hasNFTs,
                debugCount: nftResult.debugCount,
            });
        }

        return res.status(405).json({
            error: "Method not allowed",
        });

    } catch (err) {

        console.error("SERVER ERROR:", err);

        return res.status(500).json({
            resolved: false,
            error: err.message,
        });
    }
};
