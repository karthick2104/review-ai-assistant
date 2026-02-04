require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client for Groq
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// System prompt optimized for technical interviews
const SYSTEM_PROMPT = `You are an expert software engineer and technical interview assistant. Your role is to provide clear, concise, and accurate answers to technical/coding interview questions.

Guidelines:
1. **Be Direct**: Start with the answer, then explain.
2. **Code First**: For coding questions, provide working code immediately.
3. **Explain Complexity**: Always mention time and space complexity for algorithms.
4. **Use Best Practices**: Write clean, production-ready code.
5. **Be Concise**: Keep explanations brief but thorough.
6. **Format Well**: Use markdown for code blocks with proper language tags.

When answering coding questions:
- Provide the solution in the most commonly expected language (usually Python, JavaScript, or Java)
- Include brief comments in the code
- Explain the approach in 2-3 sentences after the code
- Mention edge cases if relevant

When answering conceptual questions:
- Give a clear, memorable definition first
- Provide a real-world example or analogy
- Mention common follow-up points interviewers look for`;

// Conversation history for context (In-memory storage)
let conversationHistory = [];

// API endpoint to get answer from Groq
app.post('/api/answer', async (req, res) => {
    try {
        const { transcript, clearHistory } = req.body;

        if (!transcript || transcript.trim() === '') {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                error: 'Groq API key not configured. Please add GROQ_API_KEY to .env file.'
            });
        }

        // Clear history if requested
        if (clearHistory) {
            conversationHistory = [];
        }

        // Construct messages array with system prompt and history
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory,
            { role: "user", content: transcript }
        ];

        // Keep history manageable (e.g. last 10 turns x 2 roles = 20 messages)
        // Note: We're slicing from the *user* history part, not removing the system prompt
        // Ideally, we manage `conversationHistory` as just the exchange.

        // Let's refine history management:
        // 1. Add new user message to history buffer
        conversationHistory.push({ role: 'user', content: transcript });

        // 2. Trim history if too long (keep last 20 messages)
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

        // 3. Prepare full message list for API
        const fullMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory
        ];

        // Call Groq API
        const completion = await openai.chat.completions.create({
            messages: fullMessages,
            model: "qwen/qwen3-32b",
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stream: false,
            stop: null
        });

        const answer = completion.choices[0]?.message?.content || "No response generated.";

        // Add assistant response to history
        conversationHistory.push({ role: 'assistant', content: answer });

        res.json({
            answer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({
            error: 'Failed to get response from Groq.',
            details: error.message
        });
    }
});

// Endpoint to clear conversation history
app.post('/api/clear-history', (req, res) => {
    conversationHistory = [];
    res.json({ message: 'Conversation history cleared' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        provider: 'Groq',
        model: 'qwen/qwen3-32b',
        hasApiKey: !!process.env.GROQ_API_KEY
    });
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Interview Assistant Server running at http://localhost:${PORT}`);
    if (!process.env.GROQ_API_KEY) {
        console.log('⚠️  Warning: GROQ_API_KEY not set.');
    } else {
        console.log('✅ Groq API configured with model: qwen/qwen3-32b');
    }
});
