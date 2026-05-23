// ---------------- CREATE LOGIN (POST) ----------------
        if (req.method === "POST") {
            
            // Double-check initialization states safely inside the request
            if (!apiKey || !apiSecret) {
                throw new Error("Missing credentials. Please check XAMAN_API_KEY and XAMAN_API_SECRET in your Vercel dashboard configuration variables.");
            }

            console.log("Attempting to generate Xaman sign-in payload...");
            
            // Pass 'true' as the second argument to compel the SDK to surface inner exceptions
            const payload = await sdk.payload.create({
                txjson: {
                    TransactionType: "SignIn"
                }
            }, true);

            // Log exactly what the API returned to your Vercel real-time log inspector
            console.log("Xaman API raw response object:", JSON.stringify(payload));

            if (!payload || !payload.uuid) {
                // If it returned an error object instead of a payload, capture its message
                const errorDetail = (payload && payload.error) ? ` Code: ${payload.error.code}` : "";
                throw new Error(`Xaman SDK returned an empty response.${errorDetail} Verify your API Key permissions in the Xaman Developer Console.`);
            }

            return res.status(200).json({
                uuid: payload.uuid,
                next: payload.next,
                error: null
            });
        }
