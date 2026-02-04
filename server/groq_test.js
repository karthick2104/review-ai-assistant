const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, // Using provided key
    baseURL: 'https://api.groq.com/openai/v1',
});

async function main() {
    console.log("Listing Groq models...");
    try {
        const list = await client.models.list();
        const models = list.data.map(m => m.id);
        console.log("Available Models:", models);

        // Check for Qwen
        const qwenModels = models.filter(m => m.toLowerCase().includes('qwen'));
        console.log("Qwen Models Found:", qwenModels);

        const targetModel = qwenModels.length > 0 ? qwenModels[0] : "llama3-70b-8192";
        console.log(`\nTesting with model: ${targetModel}`);

        const completion = await client.chat.completions.create({
            model: targetModel,
            messages: [{ role: 'user', content: 'Hello, are you Qwen?' }],
        });

        console.log("Response:", completion.choices[0].message.content);

    } catch (err) {
        console.error("Error:", err);
    }
}

main();
