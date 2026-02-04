// Native fetch is available in Node 18+

async function testGroqEndpoint() {
    const url = 'http://localhost:3000/api/answer';
    const payload = {
        transcript: "Who created Java?",
        clearHistory: true
    };

    console.log("Testing Groq endpoint:", url);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Server Error:", response.status, response.statusText);
            const text = await response.text();
            console.error("Body:", text);
            return;
        }

        const data = await response.json();
        console.log("Success! Response from Groq:");
        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error("Connection Error:", err.message);
    }
}

testGroqEndpoint();
