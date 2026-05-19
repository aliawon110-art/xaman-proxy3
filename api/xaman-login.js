const https = require('https');

const apiKey = '403506c7-97d3-4922-b45a-80a543decec1';
const apiSecret = '5dfb5f42-5606-4fb3-b773-859a834c4d12';

export default async function handler(req, res) {

    // =========================================================
    // CORS
    // =========================================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // =========================================================
    // CREATE XAMAN LOGIN PAYLOAD
    // =========================================================
    if (req.method === 'POST') {

        const postData = JSON.stringify({
            txjson: {
                TransactionType: 'SignIn'
            }
        });

        const options = {
            hostname: 'xumm.app',
            path: '/api/v1/platform/payload',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'X-API-Secret': apiSecret,
                'Content-Length': postData.length
            }
        };

        const xamanRes =
            await makeHttpsRequest(options, postData);

        return res.status(200).json(xamanRes);
    }

    // =========================================================
    // CHECK LOGIN + NFT COUNT
    // =========================================================
    if (req.method === 'GET') {

        const { uuid } = req.query;

        // =====================================================
        // CHECK XAMAN LOGIN STATUS
        // =====================================================

        const options = {
            hostname: 'xumm.app',
            path: `/api/v1/platform/payload/${uuid}`,
            method: 'GET',
            headers: {
                'X-API-Key': apiKey,
                'X-API-Secret': apiSecret
            }
        };

        const payloadStatus =
            await makeHttpsRequest(options);

        // User ne approve nahi kiya
        if (!payloadStatus.meta?.resolved) {

            return res.status(200).json({
                resolved: false,
                hasNFTs: false,
                debugCount: 0
            });
        }

        // =====================================================
        // GET USER WALLET ADDRESS
        // =====================================================

        const userWalletAddress =
            payloadStatus.response.account;

        console.log("Wallet:", userWalletAddress);

        // =====================================================
        // GET USER NFTs FROM XRPL
        // =====================================================

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
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': xrplPostData.length
            }
        };

        const xrplData =
            await makeHttpsRequest(
                xrplOptions,
                xrplPostData
            );

        // =====================================================
        // NFT COUNT
        // =====================================================

        const nftCount =
            xrplData?.result?.account_nfts
                ? xrplData.result.account_nfts.length
                : 0;

        console.log("NFT Count:", nftCount);

        // =====================================================
        // LOGIN CONDITION
        // 2 YA US SE ZYADA NFTs = LOGIN SUCCESS
        // =====================================================

        return res.status(200).json({
            resolved: true,
            hasNFTs: nftCount >= 2,
            debugCount: nftCount
        });
    }

    // =========================================================
    // INVALID METHOD
    // =========================================================
    return res.status(405).json({
        error: 'Method not allowed'
    });
}

// =============================================================
// HTTPS REQUEST HELPER
// =============================================================
function makeHttpsRequest(options, bodyData = null) {

    return new Promise((resolve) => {

        const req = https.request(options, (res) => {

            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {

                try {

                    resolve(JSON.parse(data));

                } catch (e) {

                    console.log("JSON Parse Error:", e);

                    resolve({});
                }
            });
        });

        req.on('error', (err) => {

            console.log("HTTPS Error:", err);

            resolve({});
        });

        if (bodyData) {
            req.write(bodyData);
        }

        req.end();
    });
}
