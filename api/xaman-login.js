const xrpl = require("xrpl");

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

        console.error("NFT FETCH ERROR:", err);

        return {
            hasNFTs: false,
            debugCount: 0,
        };

    } finally {

        client.disconnect();
    }
}
