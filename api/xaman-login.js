public static void checkNFTs(String uuid) {

    new Thread(() -> {

        try {

            for (int i = 0; i < 20; i++) {

                System.out.println("Checking login... Attempt: " + (i + 1));

                Request request = new Request.Builder()
                        .url("https://xumm.app/api/v1/platform/payload/" + uuid)
                        .get()
                        .addHeader("X-API-Key", API_KEY)
                        .addHeader("X-API-Secret", API_SECRET)
                        .build();

                Response response = client.newCall(request).execute();

                if (response.body() == null) {
                    Thread.sleep(3000);
                    continue;
                }

                String responseBody = response.body().string();

                JSONObject payloadJson =
                        new JSONObject(responseBody);

                JSONObject meta =
                        payloadJson.getJSONObject("meta");

                boolean resolved =
                        meta.getBoolean("resolved");

                // User ne approve nahi kiya abhi
                if (!resolved) {

                    Thread.sleep(3000);
                    continue;
                }

                JSONObject responseObj =
                        payloadJson.getJSONObject("response");

                String walletAddress =
                        responseObj.getString("account");

                System.out.println("Wallet: " + walletAddress);

                // =====================================================
                // XRPL NFT CHECK
                // =====================================================

                JSONObject xrplRequest = new JSONObject();

                xrplRequest.put("command", "account_nfts");
                xrplRequest.put("account", walletAddress);
                xrplRequest.put("ledger_index", "validated");

                RequestBody xrplBody = RequestBody.create(
                        xrplRequest.toString(),
                        MediaType.parse("application/json")
                );

                Request xrplReq = new Request.Builder()
                        .url("https://xrplcluster.com/")
                        .post(xrplBody)
                        .addHeader("Content-Type", "application/json")
                        .build();

                Response xrplResponse =
                        client.newCall(xrplReq).execute();

                if (xrplResponse.body() == null) {
                    return;
                }

                String xrplText =
                        xrplResponse.body().string();

                JSONObject xrplJson =
                        new JSONObject(xrplText);

                JSONObject result =
                        xrplJson.getJSONObject("result");

                JSONArray nfts =
                        result.optJSONArray("account_nfts");

                int nftCount =
                        nfts != null ? nfts.length() : 0;

                System.out.println("NFT Count: " + nftCount);

                // =====================================================
                // LOGIN SUCCESS
                // =====================================================

                if (nftCount >= 2) {

                    System.out.println("LOGIN SUCCESS");
                    System.out.println("Access Granted");

                } else {

                    System.out.println("LOGIN FAILED");
                    System.out.println("Need at least 2 NFTs");
                }

                return;
            }

            System.out.println("Login timeout");

        } catch (Exception e) {

            System.out.println(
                    "CheckNFT Error: " + e.getMessage()
            );
        }

    }).start();
}
