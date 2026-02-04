/**
 * Gemini API Communication Module
 * Handles API calls to the backend
 */

class GeminiAPI {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || '';
        this.onResponse = options.onResponse || (() => { });
        this.onError = options.onError || (() => { });
        this.onLoading = options.onLoading || (() => { });

        this.isLoading = false;
        this.abortController = null;
    }

    async getAnswer(transcript, clearHistory = false) {
        if (this.isLoading) {
            console.log('Already loading, skipping request');
            return null;
        }

        if (!transcript || transcript.trim() === '') {
            return null;
        }

        this.isLoading = true;
        this.onLoading(true);

        try {
            this.abortController = new AbortController();

            const response = await fetch(`${this.baseUrl}/api/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcript: transcript.trim(),
                    clearHistory
                }),
                signal: this.abortController.signal
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get response');
            }

            this.onResponse(data);
            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was aborted');
                return null;
            }

            console.error('API Error:', error);
            this.onError({
                type: 'api-error',
                message: error.message || 'Failed to connect to server'
            });
            return null;

        } finally {
            this.isLoading = false;
            this.onLoading(false);
            this.abortController = null;
        }
    }

    async clearHistory() {
        try {
            const response = await fetch(`${this.baseUrl}/api/clear-history`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to clear history');
            }

            return true;
        } catch (error) {
            console.error('Clear history error:', error);
            return false;
        }
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', hasApiKey: false };
        }
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}

// Export for use in app.js
window.GeminiAPI = GeminiAPI;
