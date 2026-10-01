(function () {
    const chatbot = document.querySelector('[data-chatbot]');
    if (!chatbot) return;

    const toggle = chatbot.querySelector('[data-chatbot-toggle]');
    const panel = chatbot.querySelector('[data-chatbot-panel]');
    const close = chatbot.querySelector('[data-chatbot-close]');
    const form = chatbot.querySelector('[data-chatbot-form]');
    const input = chatbot.querySelector('[data-chatbot-input]');
    const messages = chatbot.querySelector('[data-chatbot-messages]');
    const suggestions = chatbot.querySelector('[data-chatbot-suggestions]');
    const status = chatbot.querySelector('[data-chatbot-status]');
    const csrfToken = chatbot.dataset.csrfToken;

    function setOpen(open) {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) input.focus();
    }

    function addMessage(text, kind, link) {
        const message = document.createElement('div');
        message.className = `chatbot-message chatbot-message--${kind}`;
        message.textContent = text;
        if (link && link.href && link.label) {
            const linkElement = document.createElement('a');
            linkElement.className = 'chatbot-link';
            linkElement.href = link.href;
            linkElement.textContent = link.label;
            message.appendChild(linkElement);
        }
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
    }

    function updateSuggestions(items) {
        suggestions.innerHTML = '';
        (items || []).forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.chatbotSuggestion = item;
            button.textContent = item;
            suggestions.appendChild(button);
        });
    }

    async function sendMessage(message) {
        addMessage(message, 'user');
        status.textContent = 'Thinking...';
        input.disabled = true;
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to send message.');
            addMessage(data.reply, 'assistant', data.link);
            updateSuggestions(data.suggestions);
            status.textContent = '';
        } catch (error) {
            status.textContent = error.message;
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) return;
        input.value = '';
        sendMessage(message);
    });
    suggestions.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chatbot-suggestion]');
        if (!button) return;
        sendMessage(button.dataset.chatbotSuggestion);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-chatbot-close]')) return;
        setOpen(false);
    });
})();
