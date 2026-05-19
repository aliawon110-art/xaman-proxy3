// api/xaman-login.js
const { XummSdk } = require('xumm-sdk');
const https = require('https'); 

// ⚡ Keys initialized safely
const apiKey = '403506c7-97d3-4922-b45a-80a543decec1'; 
const apiSecret = '5dfb5f42-5606-4fb3-b773-859a834c4d12';

let Sdk;
try {
    if (apiKey && apiKey !== 'YOUR_XAMAN_API_KEY') {
        Sdk = new XummSdk(apiKey, apiSecret);
    }
} catch (e) {
    console.error("Xaman SDK Init Error:", e.message);
}

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!Sdk) {
        return res.status(200).json({ 
            error: "Backend Setup Pending: API Keys are not initialized properly." 
        });
    }

    // -------------------------------------------------------
    // CASE 1: POST Request (Unity payload request)
    // -------------------------------------------------------
    if (req.method === 'POST') {
        try {
            const payload = await Sdk.payload.create({
                txjson: {
                    TransactionType: 'SignIn'
                }
            });
            
            return res.status(200).json({
                uuid: payload.uuid,
                next: {
                    always: payload.next.always
                }
            });
        } catch (error) {
            return res.status(200).json({ error: "Xaman Payload Error: " + error.message });
        }
    }

    // -------------------------------------------------------
    // CASE 2: GET Request (Unity polling mechanism)
    // -------------------------------------------------------
    if (req.method === 'GET') {
        const { uuid } = req.query;
        if (!uuid) {
            return res.status(400).json({ error: "Missing uuid parameter" });
        }

        try {
            const payloadStatus = await Sdk.payload.get(uuid);

            if (!payloadStatus || !payloadStatus.meta) {
                return res.status(200).json({ resolved: false, hasNFTs: false });
            }

            if (!payloadStatus.meta.resolved) {
                return res.status(200).json({ resolved: false, hasNFTs: false });
            }

            if (payloadStatus.meta.resolved && !payloadStatus.meta.signed) {
                return res.status(200).json({ resolved: true, hasNFTs: false });
            }

            const userWalletAddress = payloadStatus.response.account;

            // Strict fallback check for standard NFTs
            const xrplData = await callXrplLedger(userWalletAddress);
            const nftList = (xrplData && xrplData.result && xrplData.result.account_nfts) ? xrplData.result.account_nfts : [];
            
            const totalNFTs = nftList.length;
            const userHas3NFTs = totalNFTs >= 3;

            return res.status(200).json({
                resolved: true,
                hasNFTs: userHas3NFTs
            });

        } catch (error) {
            return res.status(200).json({ error: "GET Verification Error: " + error.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}

function callXrplLedger(accountAddress) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            command: "account_nfts",
            account: accountAddress,
            ledger_index: "validated"
        });

        const options = {
            hostname: 'xrplcluster.com',
            port: 443, 
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } 
                catch (e) { resolve({}); }
            });
        });

        req.on('error', (e) => { resolve({}); });
        req.write(postData);
        req.end();
    });
}
