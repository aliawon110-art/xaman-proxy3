// api/xaman-login.js
const https = require('https');
const apiKey = '403506c7-97d3-4922-b45a-80a543decec1';
const apiSecret = '5dfb5f42-5606-4fb3-b773-859a834c4d12';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    // ... (rest of the headers)

    if (req.method === 'GET') {
        const { uuid } = req.query;
        // ... (payload status check)

        const userWalletAddress = payloadStatus.response.account;

        // XRPL Node check (Strict 3 NFTs check)
        const xrplPostData = JSON.stringify({
            command: "account_nfts",
            account: userWalletAddress,
            ledger_index: "validated"
        });

        const xrplData = await makeHttpsRequest(xrplOptions, xrplPostData);
        const nftList = (xrplData && xrplData.result && xrplData.result.account_nfts) ? xrplData.result.account_nfts : [];
        
        // STRICT LOGIC: Sirf 3 ya us se zyada par true jayega
        const hasRequiredNFTs = nftList.length >= 3;

        return res.status(200).json({
            resolved: true,
            hasNFTs: hasRequiredNFTs, // Yahan ab strict check hoga
            debugCount: nftList.length
        });
    }
}
