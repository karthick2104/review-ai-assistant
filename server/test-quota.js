require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function checkQuota() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
        console.error('❌ Error: GEMINI_API_KEY not found in .env file');
        return;
    }

    console.log('🔍 Checking quota for API key:', apiKey.substring(0, 8) + '...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    try {
        const result = await model.generateContent('Hello, are you working?');
        const response = await result.response;
        console.log('✅ Success! API is working.');
        console.log('Response:', response.text());
    } catch (error) {
        console.error('❌ API Error:');
        if (error.message.includes('429')) {
            console.error('⚠️ Quota Exceeded (429 Too Many Requests). You may have hit the free tier limit.');
        } else if (error.message.includes('401') || error.message.includes('API_KEY_INVALID')) {
            console.error('⚠️ Invalid API Key (401 Unauthorized). Please check your key.');
        } else if (error.message.includes('403')) {
            console.error('⚠️ Permission Denied (403 Forbidden). Check if the API is enabled for your project.');
        } else {
            console.error(error.message);
        }
    }
}

checkQuota();
