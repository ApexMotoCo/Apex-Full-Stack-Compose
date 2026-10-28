(function () {
    const composer = document.querySelector('[data-marketing-campaign-form]');
    if (composer) {
        const status = document.querySelector('[data-marketing-campaign-status]');
        const scheduleInput = composer.querySelector('[name="scheduledAt"]');
        const minDate = new Date(Date.now() + 5 * 60 * 1000);
        const localMin = new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        scheduleInput.min = localMin;

        composer.addEventListener('submit', async (event) => {
            event.preventDefault();
            const action = event.submitter && event.submitter.value;
            const payload = Object.fromEntries(new FormData(composer));
            payload.action = action;

            if (action === 'schedule') {
                if (!payload.scheduledAt) {
                    status.textContent = 'Choose a send time before scheduling.';
                    return;
                }
                payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
            } else {
                payload.scheduledAt = '';
            }

            status.textContent = action === 'schedule' ? 'Scheduling campaign...' : 'Saving campaign draft...';
            const buttons = composer.querySelectorAll('button[type="submit"]');
            buttons.forEach((button) => { button.disabled = true; });

            try {
                const response = await fetch('/admin/marketing-campaigns', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': composer.dataset.csrfToken
                    },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Unable to save the campaign.');
                status.textContent = `${data.message} Eligible subscribers: ${data.recipientCount}.`;
                window.setTimeout(() => { window.location.href = '/admin/marketing-campaigns'; }, 800);
            } catch (error) {
                status.textContent = error.message || 'Unable to save the campaign.';
            } finally {
                buttons.forEach((button) => { button.disabled = false; });
            }
        });
    }

    const campaigns = document.querySelector('[data-marketing-campaigns]');
    if (!campaigns) return;

    const historyStatus = campaigns.querySelector('[data-campaign-history-status]');
    const csrfToken = campaigns.dataset.csrfToken;

    campaigns.addEventListener('click', async (event) => {
        const sendButton = event.target.closest('[data-send-campaign]');
        const cancelButton = event.target.closest('[data-cancel-campaign]');
        if (!sendButton && !cancelButton) return;

        const campaignId = (sendButton || cancelButton).dataset[
            sendButton ? 'sendCampaign' : 'cancelCampaign'
        ];
        const action = sendButton ? 'send' : 'cancel';

        if (sendButton && !window.confirm(
            `Send "${sendButton.dataset.campaignName}" now to all currently opted-in subscribers? This cannot be undone.`
        )) return;
        if (cancelButton && !window.confirm('Cancel this scheduled campaign?')) return;

        historyStatus.textContent = action === 'send' ? 'Sending campaign...' : 'Cancelling schedule...';
        sendButton && (sendButton.disabled = true);
        cancelButton && (cancelButton.disabled = true);

        try {
            const response = await fetch(`/admin/marketing-campaigns/${encodeURIComponent(campaignId)}/${action}`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to ${action} the campaign.`);
            historyStatus.textContent = data.message;
            window.setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            historyStatus.textContent = error.message || `Unable to ${action} the campaign.`;
            sendButton && (sendButton.disabled = false);
            cancelButton && (cancelButton.disabled = false);
        }
    });
})();
