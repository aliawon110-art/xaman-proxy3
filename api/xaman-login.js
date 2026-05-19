```java id="8b1f1q"
package com.example.xamanlogin;

import okhttp3.*;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;

public class XamanNFTLogin {

    // =====================================================
    // XAMAN API KEYS
    // =====================================================
    private static final String API_KEY =
            "403506c7-97d3-4922-b45a-80a543decec1";

    private static final String API_SECRET =
            "5dfb5f42-5606-4fb3-b773-859a834c4d12";

    private static final OkHttpClient client =
            new OkHttpClient();

    // =====================================================
    // CREATE LOGIN PAYLOAD
    // =====================================================
    public static void createLoginPayload() {

        try {

            JSONObject txjson = new JSONObject();
            txjson.put("TransactionType", "SignIn");

            JSONObject body = new JSONObject();
            body.put("txjson", txjson);

            RequestBody requestBody = RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                    .url("https://xumm.app/api/v1/platform/payload")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-API-Key", API_KEY)
                    .addHeader("X-API-Secret", API_SECRET)
                    .build();

            client.newCall(request).enqueue(new Callback() {

                @Override
                public void onFailure(Call call, IOException e) {
                    System.out.println("Login Payload Error: " + e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response)
                        throws IOException {

                    if (response.body() == null) return;

                    String responseBody = response.body().string();

                    try {

                        JSONObject json = new JSONObject(responseBody);

                        String uuid = json.getString("uuid");

                        JSONObject next = json.getJSONObject("next");

                        String loginUrl = next.getString("always");

                        System.out.println("UUID: " + uuid);
                        System.out.println("Open Xaman Wallet:");
                        System.out.println(loginUrl);

                        // Ab NFT verification start karo
                        checkNFTs(uuid);

                    } catch (Exception ex) {
                        System.out.println("Parse Error: " + ex.getMessage());
                    }
                }
            });

        } catch (Exception e) {
            System.out.println("Create Payload Error: " + e.getMessage());
        }
    }

    // =====================================================
    // CHECK USER NFT COUNT
    // =====================================================
    public static void checkNFTs(String uuid) {

        Request request = new Request.Builder()
                .url("https://xumm.app/api/v1/platform/payload/" + uuid)
                .get()
                .addHeader("X-API-Key", API_KEY)
                .addHeader("X-API-Secret", API_SECRET)
                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(Call call, IOException e) {
                System.out.println("Verification Error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response)
                    throws IOException {

                if (response.body() == null) return;

                String responseBody = response.body().string();

                try {

                    JSONObject payloadJson =
                            new JSONObject(responseBody);

                    JSONObject meta =
                            payloadJson.getJSONObject("meta");

                    boolean resolved =
                            meta.getBoolean("resolved");

                    if (!resolved) {

                        System.out.println("User ne abhi sign nahi kiya.");
                        return;
                    }

                    JSONObject responseObj =
                            payloadJson.getJSONObject("response");

                    String walletAddress =
                            responseObj.getString("account");

                    System.out.println("Wallet: " + walletAddress);

                    // =====================================================
                    // XRPL NFT REQUEST
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

                    client.newCall(xrplReq).enqueue(new Callback() {

                        @Override
                        public void onFailure(Call call, IOException e) {
                            System.out.println("XRPL Error: " + e.getMessage());
                        }

                        @Override
                        public void onResponse(Call call, Response response)
                                throws IOException {

                            if (response.body() == null) return;

                            String xrplResponse =
                                    response.body().string();

                            try {

                                JSONObject xrplJson =
                                        new JSONObject(xrplResponse);

                                JSONObject result =
                                        xrplJson.getJSONObject("result");

                                JSONArray nfts =
                                        result.optJSONArray("account_nfts");

                                int nftCount =
                                        nfts != null ? nfts.length() : 0;

                                System.out.println("NFT Count: " + nftCount);

                                // =====================================================
                                // LOGIN CONDITION
                                // 2 YA US SE ZYADA NFTs = LOGIN SUCCESS
                                // =====================================================
                                if (nftCount >= 2) {

                                    System.out.println("LOGIN SUCCESS");
                                    System.out.println("Access Granted");

                                } else {

                                    System.out.println("LOGIN FAILED");
                                    System.out.println(
                                            "Need at least 2 NFTs"
                                    );
                                }

                            } catch (Exception ex) {

                                System.out.println(
                                        "XRPL Parse Error: "
                                                + ex.getMessage()
                                );
                            }
                        }
                    });

                } catch (Exception ex) {

                    System.out.println(
                            "Payload Parse Error: "
                                    + ex.getMessage()
                    );
                }
            }
        });
    }

    // =====================================================
    // MAIN
    // =====================================================
    public static void main(String[] args) {

        createLoginPayload();

        // App ko band hone se bachane ke liye
        try {
            Thread.sleep(60000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```
