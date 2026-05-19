const https = require('https');

const apiKey = '403506c7-97d3-4922-b45a-80a543decec1';
const apiSecret = '5dfb5f42-5606-4fb3-b773-859a834c4d12';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        // ... (Login Request Logic) ...
    }

    if (req.method === 'GET') {
        const { uuid } = req.query;
        // ... (Xaman Status check logic) ...

        const userWalletAddress = payloadStatus.response.account;

        // XRPL Check
        const xrplPostData = JSON.stringify({
            command: "account_nfts",
            account: userWalletAddress,
            ledger_index: "validated"
        });

        // (Make HTTPS Request to XRPL Cluster)
        const xrplData = await makeHttpsRequest(xrplOptions, xrplPostData);
        const nftCount = (xrplData && xrplData.result && xrplData.result.account_nfts) ? xrplData.result.account_nfts.length : 0;

        // STRICT LOGIC: 3 NFTs check
        return res.status(200).json({
            resolved: true,
            hasNFTs: nftCount >= 3,
            debugCount: nftCount 
        });
    }
}
