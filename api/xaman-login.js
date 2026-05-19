// api/xaman-login.js
const { XummSdk } = require('xumm-sdk');
// Apni asli Xaman API Credentials yahan daalein ya process.env se uthayein
const Sdk = new XummSdk('YOUR_XAMAN_API_KEY', 'YOUR_XAMAN_API_SECRET');

export default async function handler(req, res) {
    // CORS Headers taake Unity WebGL/Editor block na ho
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // -------------------------------------------------------
    // CASE 1: POST Request (Unity jab login request generate karegi)
    // -------------------------------------------------------
    if (req.method === 'POST') {
        try {
            const payload = await Sdk.payload.create({
                txjson: {
                    TransactionType: 'SignIn'
                }
            });
            
            // Return uuid and redirect url to Unity
            return res.status(200).json({
                uuid: payload.uuid,
                next: {
                    always: payload.next.always
                }
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // -------------------------------------------------------
    // CASE 2: GET Request (Unity jab status check karegi: ?uuid=xxxx)
    // -------------------------------------------------------
    if (req.method === 'GET') {
        const { uuid } = req.query;
        if (!uuid) {
            return res.status(400).json({ error: "Missing uuid parameter" });
        }

        try {
            // 1. Xaman se payload ka status verify karo
            const payloadStatus = await Sdk.payload.get(uuid);

            // Agar user ne abhi tak wallet me sign/reject nahi kiya (Pending state)
            if (!payloadStatus.meta.resolved) {
                return res.status(200).json({
                    resolved: false,
                    hasNFTs: false
                });
            }

            // Agar user ne request reject kar di ya expire ho gayi
            if (payloadStatus.meta.resolved && !payloadStatus.meta.signed) {
                return res.status(200).json({
                    resolved: true,
                    hasNFTs: false // Sign hi nahi kiya toh reject mano
                });
            }

            // 2. Agar user ne successfully sign kar diya, toh uska wallet address uthao
            const userWalletAddress = payloadStatus.response.account;

            // 3. XRPL Ledger par request bhej kar check karo bande ke paas kitne NFTs hain
            // Hum yahan public XRPL cluster RPC ka use kar rahe hain
            const xrplResponse = await fetch('https://xrplcluster.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: "account_nfts",
                    account: userWalletAddress,
                    ledger_index: "validated"
                })
            });

            const xrplData = await xrplResponse.json();
            const nftList = xrplData.result.account_nfts || [];
            
            // 🔴 MAIN CHECK: Kya bande ke paas 3 ya us se zyaada NFTs hain?
            const totalNFTs = nftList.length;
            const userHas3NFTs = totalNFTs >= 3;

            console.log(`Address: ${userWalletAddress} has total NFTs: ${totalNFTs}`);

            // Final response jo Unity read karegi
            return res.status(200).json({
                resolved: true,
                hasNFTs: userHas3NFTs
            });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
