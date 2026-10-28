(function () {
    const assistant = document.querySelector('[data-marketing-assistant]');
    if (!assistant) return;

    const form = assistant.querySelector('[data-marketing-form]');
    const submit = assistant.querySelector('[data-marketing-submit]');
    const status = assistant.querySelector('[data-marketing-status]');
    const draft = assistant.querySelector('[data-marketing-draft]');
    const copyButton = assistant.querySelector('[data-marketing-copy]');
    const useInEmailButton = assistant.querySelector('[data-marketing-use-email]');
    const campaignBody = document.querySelector('[name="body"][form="marketing-campaign-form"]') ||
        document.querySelector('[data-marketing-campaign-form] [name="body"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        copyButton.disabled = true;
        status.textContent = 'Creating your draft...';

        try {
            const response = await fetch('/admin/marketing-assistant/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': assistant.dataset.csrfToken
                },
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Unable to generate a marketing draft.');
            }

            draft.textContent = data.draft;
            copyButton.disabled = false;
            useInEmailButton.disabled = false;
            status.textContent = 'Draft ready. Review all facts before publishing.';
        } catch (error) {
            status.textContent = error.message || 'Unable to generate a marketing draft.';
        } finally {
            submit.disabled = false;
        }
    });

    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(draft.textContent);
            status.textContent = 'Draft copied to clipboard.';
        } catch (error) {
            status.textContent = 'Clipboard access failed. Select and copy the draft instead.';
        }
    });

    useInEmailButton.addEventListener('click', () => {
        if (!campaignBody) return;
        campaignBody.value = draft.textContent;
        campaignBody.focus();
        campaignBody.scrollIntoView({ behavior: 'smooth', block: 'center' });
        status.textContent = 'Draft added to the email campaign. Add a subject and review it before saving or scheduling.';
    });
})();
