/**
 * Interview Assistant - Main Application
 * Coordinates speech recognition, UI, and API communication
 */

$(document).ready(function () {
    // DOM Elements
    const $listenBtn = $('#listenBtn');
    const $listenBtnText = $('.listen-btn-text');
    const $statusIndicator = $('#statusIndicator');
    const $statusText = $('.status-text');
    const $pauseTimer = $('#pauseTimer');
    const $timerValue = $('#timerValue');
    const $transcriptContent = $('#transcriptContent');
    const $answerContent = $('#answerContent');
    const $loadingIndicator = $('#loadingIndicator');
    const $clearTranscript = $('#clearTranscript');
    const $clearHistory = $('#clearHistory');
    const $pauseThreshold = $('#pauseThreshold');
    const $pauseValue = $('#pauseValue');
    const $micBtn = $('#micBtn');
    const $systemBtn = $('#systemBtn');
    const $toastContainer = $('#toastContainer');

    // State
    let isListening = false;
    let currentTranscript = '';
    let audioSource = 'microphone';

    // Initialize modules
    const speech = new SpeechHandler({
        pauseThreshold: parseFloat($pauseThreshold.val()) * 1000,

        onTranscript: (transcript) => {
            currentTranscript = transcript;
            updateTranscriptDisplay(transcript);
        },

        onInterim: (interim) => {
            updateTranscriptDisplay(currentTranscript, interim);
        },

        onPauseDetected: (transcript) => {
            console.log('Pause detected, sending transcript:', transcript);
            gemini.getAnswer(transcript);
        },

        onError: (error) => {
            showToast(error.message, 'error');
            if (error.type !== 'no-speech') {
                stopListening();
            }
        },

        onStatusChange: (status) => {
            updateStatus(status);
        }
    });

    const gemini = new GeminiAPI({
        onResponse: (data) => {
            displayAnswer(data.answer);
        },

        onError: (error) => {
            showToast(error.message, 'error');
        },

        onLoading: (loading) => {
            $loadingIndicator.toggleClass('visible', loading);
            $statusIndicator.toggleClass('processing', loading);
            if (loading) {
                $statusText.text('Generating answer...');
            }
        }
    });

    // Check browser support
    if (!speech.isSupported()) {
        $listenBtn.prop('disabled', true);
        showToast('Speech Recognition not supported. Please use Chrome or Edge.', 'error');
    }

    // Check server health on load
    checkServerHealth();

    // Event Handlers
    $listenBtn.on('click', function () {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });

    $clearTranscript.on('click', function () {
        speech.clearTranscript();
        currentTranscript = '';
        $transcriptContent.html('<p class="placeholder-text">Start listening to see the transcript here...</p>');
    });

    $clearHistory.on('click', async function () {
        const cleared = await gemini.clearHistory();
        if (cleared) {
            speech.clearTranscript();
            currentTranscript = '';
            $transcriptContent.html('<p class="placeholder-text">Start listening to see the transcript here...</p>');
            $answerContent.html('<p class="placeholder-text">Answers will appear here after a question is detected...</p>');
            showToast('Conversation cleared', 'success');
        }
    });

    $pauseThreshold.on('input', function () {
        const value = parseFloat($(this).val());
        $pauseValue.text(value.toFixed(1));
        speech.setPauseThreshold(value * 1000);
    });

    $micBtn.on('click', function () {
        setAudioSource('microphone');
    });

    $systemBtn.on('click', function () {
        setAudioSource('system');
    });

    // Functions
    function startListening() {
        if (audioSource === 'system') {
            startSystemAudioCapture();
        } else {
            if (speech.start()) {
                isListening = true;
                $listenBtn.addClass('listening');
                $listenBtnText.text('Stop');
                $statusIndicator.addClass('listening');
                $statusText.text('Listening...');
            }
        }
    }

    function stopListening() {
        speech.stop();
        isListening = false;
        $listenBtn.removeClass('listening');
        $listenBtnText.text('Start Listening');
        $statusIndicator.removeClass('listening processing');
        $statusText.text('Ready to listen');
        $pauseTimer.removeClass('visible');
    }

    function setAudioSource(source) {
        audioSource = source;
        $micBtn.toggleClass('active', source === 'microphone');
        $systemBtn.toggleClass('active', source === 'system');

        if (source === 'system') {
            showToast('System audio: Click Start, then share your screen with audio', 'info');
        }
    }

    async function startSystemAudioCapture() {
        try {
            // Request screen capture with audio
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Check if audio track is available
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                showToast('No audio track found. Make sure to share "Tab Audio" or "System Audio"', 'error');
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            // For now, we still use Web Speech API with microphone
            // System audio capture would require server-side transcription
            showToast('System audio capture started. Note: Transcription uses your mic for best results.', 'info');

            if (speech.start()) {
                isListening = true;
                $listenBtn.addClass('listening');
                $listenBtnText.text('Stop');
                $statusIndicator.addClass('listening');
                $statusText.text('Listening (System Audio)...');
            }

            // Stop video track, keep audio for monitoring
            stream.getVideoTracks().forEach(t => t.stop());

        } catch (error) {
            console.error('Screen capture error:', error);
            if (error.name === 'NotAllowedError') {
                showToast('Screen sharing was denied', 'error');
            } else {
                showToast('Failed to capture system audio', 'error');
            }
        }
    }

    function updateTranscriptDisplay(transcript, interim = '') {
        let html = '';

        if (transcript) {
            html += `<span class="final">${escapeHtml(transcript)}</span>`;
        }

        if (interim) {
            html += `<span class="interim"> ${escapeHtml(interim)}</span>`;
        }

        if (html) {
            $transcriptContent.html(`<p class="transcript-text">${html}</p>`);
            // Auto-scroll to bottom
            $transcriptContent.scrollTop($transcriptContent[0].scrollHeight);
        }
    }

    function updateStatus(status) {
        if (status.silenceDuration !== undefined) {
            const seconds = (status.silenceDuration / 1000).toFixed(1);
            $timerValue.text(`${seconds}s`);
            $pauseTimer.addClass('visible');

            // Highlight when approaching threshold
            const threshold = parseFloat($pauseThreshold.val());
            if (status.silenceDuration >= threshold * 1000) {
                $timerValue.css('color', 'var(--success)');
            } else {
                $timerValue.css('color', 'var(--accent-primary)');
            }
        } else {
            $pauseTimer.removeClass('visible');
        }

        if (status.message && !$loadingIndicator.hasClass('visible')) {
            $statusText.text(status.message);
        }
    }

    function displayAnswer(markdown) {
        // Configure marked for proper rendering
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // Parse markdown to HTML
        let html = marked.parse(markdown);

        // Add code block headers and copy buttons
        html = html.replace(/<pre><code class="language-(\w+)">/g, function (match, lang) {
            return `<div class="code-block">
                <div class="code-block-header">
                    <span class="code-lang">${lang}</span>
                    <button class="copy-btn" onclick="copyCode(this)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                    </button>
                </div>
                <pre><code class="language-${lang}">`;
        });

        html = html.replace(/<pre><code>/g, `<div class="code-block">
            <div class="code-block-header">
                <span class="code-lang">code</span>
                <button class="copy-btn" onclick="copyCode(this)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                </button>
            </div>
            <pre><code>`);

        html = html.replace(/<\/code><\/pre>/g, '</code></pre></div>');

        $answerContent.html(html);

        // Apply syntax highlighting
        $answerContent.find('pre code').each(function () {
            hljs.highlightElement(this);
        });

        // Scroll to top of answer
        $answerContent.scrollTop(0);
    }

    async function checkServerHealth() {
        const health = await gemini.checkHealth();

        if (health.status !== 'ok') {
            showToast('Cannot connect to server. Make sure the server is running.', 'error');
        } else if (!health.hasApiKey) {
            showToast('Gemini API key not configured. Add your key to the .env file.', 'error');
        }
    }

    function showToast(message, type = 'info') {
        const $toast = $(`<div class="toast ${type}">${escapeHtml(message)}</div>`);
        $toastContainer.append($toast);

        setTimeout(() => {
            $toast.fadeOut(300, function () {
                $(this).remove();
            });
        }, 4000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

// Global function for copy button
function copyCode(button) {
    const codeBlock = $(button).closest('.code-block');
    const code = codeBlock.find('code').text();

    navigator.clipboard.writeText(code).then(() => {
        const $btn = $(button);
        $btn.addClass('copied');
        $btn.find('svg').hide();
        $btn.contents().filter(function () {
            return this.nodeType === 3;
        }).first().replaceWith(' Copied!');

        setTimeout(() => {
            $btn.removeClass('copied');
            $btn.find('svg').show();
            $btn.contents().filter(function () {
                return this.nodeType === 3;
            }).first().replaceWith(' Copy');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}
