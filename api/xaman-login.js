// api/xaman-login.js
const https = require('https');
const apiKey = '403506c7-97d3-4922-b45a-80a543decec1';
const apiSecret = '5dfb5f42-5606-4fb3-b773-859a834c4d12';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const { uuid } = req.query;
        // ... (payload verification logic) ...

        const userWalletAddress = payloadStatus.response.account;

        // XRPL Node check (Strict 3 NFTs check)
        const xrplPostData = JSON.stringify({
            command: "account_nfts",
            account: userWalletAddress,
            ledger_index: "validated"
        });

        const xrplOptions = {
            hostname: 'xrplcluster.com',
            port: 443,
            path: '/',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': xrplPostData.length }
        };

        const xrplData = await makeHttpsRequest(xrplOptions, xrplPostData);
        const nftList = (xrplData && xrplData.result && xrplData.result.account_nfts) ? xrplData.result.account_nfts : [];
        
        // STRICTURE CHECK: 3 se kam hone par hasNFTs false jayega
        const hasRequiredNFTs = nftList.length >= 3;

        return res.status(200).json({
            resolved: true,
            hasNFTs: hasRequiredNFTs,
            debugCount: nftList.length // Unity console mein count dikhega
        });
    }
    // ... (rest of the code)
}
