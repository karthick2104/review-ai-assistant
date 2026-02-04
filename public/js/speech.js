/**
 * Speech Recognition Module
 * Handles Web Speech API with pause detection
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

class SpeechHandler {
    constructor(options = {}) {
        this.onTranscript = options.onTranscript || (() => { });
        this.onInterim = options.onInterim || (() => { });
        this.onPauseDetected = options.onPauseDetected || (() => { });
        this.onError = options.onError || (() => { });
        this.onStatusChange = options.onStatusChange || (() => { });

        this.recognition = null;
        this.isListening = false;
        this.pauseThreshold = options.pauseThreshold || 2000; // 2 seconds default

        this.transcript = '';
        this.interimTranscript = '';
        this.lastSpeechTime = 0;
        this.pauseTimer = null;
        this.pauseCheckInterval = null;
        this.hasNewContent = false;
        this.lastProcessedTranscript = '';

        this.init();
    }

    init() {
        if (!SpeechRecognition) {
            this.onError({
                type: 'not-supported',
                message: 'Speech Recognition is not supported in this browser. Please use Chrome or Edge.'
            });
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (!this.recognition) return;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.onStatusChange({ status: 'listening', message: 'Listening...' });
            this.startPauseDetection();
        };

        this.recognition.onend = () => {
            // Auto-restart if still supposed to be listening
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch (e) {
                    // Ignore - may already be starting
                }
            } else {
                this.stopPauseDetection();
                this.onStatusChange({ status: 'stopped', message: 'Stopped listening' });
            }
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;

                if (result.isFinal) {
                    finalTranscript += text + ' ';
                } else {
                    interimTranscript += text;
                }
            }

            if (finalTranscript) {
                this.transcript += finalTranscript;
                this.hasNewContent = true;
                this.lastSpeechTime = Date.now();
                this.onTranscript(this.transcript.trim());
            }

            this.interimTranscript = interimTranscript;
            if (interimTranscript) {
                this.lastSpeechTime = Date.now();
                this.onInterim(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            const errorMessages = {
                'no-speech': 'No speech detected. Please speak louder.',
                'audio-capture': 'Microphone not found. Please check your microphone.',
                'not-allowed': 'Microphone access denied. Please allow microphone access.',
                'network': 'Network error. Please check your connection.',
                'aborted': 'Recognition was aborted.',
                'service-not-allowed': 'Speech service not allowed.'
            };

            const message = errorMessages[event.error] || `Error: ${event.error}`;

            // Don't stop for no-speech errors, just continue
            if (event.error === 'no-speech') {
                return;
            }

            this.onError({
                type: event.error,
                message: message
            });
        };

        this.recognition.onspeechend = () => {
            // Speech ended - start counting pause
            this.lastSpeechTime = Date.now();
        };
    }

    startPauseDetection() {
        this.lastSpeechTime = Date.now();

        this.pauseCheckInterval = setInterval(() => {
            if (!this.isListening) return;

            const silenceDuration = Date.now() - this.lastSpeechTime;

            // Emit pause timer update for UI
            if (silenceDuration > 500) {
                this.onStatusChange({
                    status: 'listening',
                    message: 'Listening...',
                    silenceDuration: silenceDuration
                });
            }

            // Check if pause threshold reached and we have new content
            if (silenceDuration >= this.pauseThreshold && this.hasNewContent) {
                const newContent = this.transcript.trim();

                // Only trigger if we have actual new content
                if (newContent && newContent !== this.lastProcessedTranscript) {
                    this.hasNewContent = false;
                    this.lastProcessedTranscript = newContent;
                    this.onPauseDetected(newContent);
                }
            }
        }, 100);
    }

    stopPauseDetection() {
        if (this.pauseCheckInterval) {
            clearInterval(this.pauseCheckInterval);
            this.pauseCheckInterval = null;
        }
    }

    start() {
        if (!this.recognition) {
            this.onError({
                type: 'not-supported',
                message: 'Speech Recognition is not available.'
            });
            return false;
        }

        try {
            this.isListening = true;
            this.transcript = '';
            this.interimTranscript = '';
            this.hasNewContent = false;
            this.lastProcessedTranscript = '';
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.isListening = false;
            this.onError({
                type: 'start-failed',
                message: 'Failed to start speech recognition.'
            });
            return false;
        }
    }

    stop() {
        this.isListening = false;
        this.stopPauseDetection();

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore
            }
        }
    }

    setPauseThreshold(ms) {
        this.pauseThreshold = ms;
    }

    clearTranscript() {
        this.transcript = '';
        this.interimTranscript = '';
        this.hasNewContent = false;
        this.lastProcessedTranscript = '';
    }

    getTranscript() {
        return this.transcript.trim();
    }

    isSupported() {
        return !!SpeechRecognition;
    }
}

// Export for use in app.js
window.SpeechHandler = SpeechHandler;
