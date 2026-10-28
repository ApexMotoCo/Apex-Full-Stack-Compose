const crypto = require('crypto');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      return resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      return resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      return resolve(rows || []);
    });
  });
}

function unsubscribeSecret() {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET;
}

function createUnsubscribeToken(userId, consentedAt, source = 'user') {
  const secret = unsubscribeSecret();
  if (!secret) throw new Error('SESSION_SECRET must be configured for marketing unsubscribes.');

  const payload = Buffer.from(JSON.stringify({ userId, consentedAt, source })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyUnsubscribeToken(token) {
  const secret = unsubscribeSecret();
  if (!secret || typeof token !== 'string') return null;

  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/.test(suppliedSignature)) return null;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const supplied = Buffer.from(suppliedSignature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');

  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(data.userId) || typeof data.consentedAt !== 'string' ||
        !['user', 'subscriber'].includes(data.source || 'user')) return null;
    data.source = data.source || 'user';
    return data;
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getOptedInRecipientCount(db) {
  return get(
    db,
    `SELECT COUNT(*) AS count
     FROM (
       SELECT lower(trim(email)) AS email FROM users
       WHERE marketing_consent = 1 AND marketing_consent_at IS NOT NULL
         AND email IS NOT NULL AND TRIM(email) <> ''
       UNION
       SELECT lower(trim(email)) AS email FROM marketing_subscribers
       WHERE consented_at IS NOT NULL AND unsubscribed_at IS NULL
         AND email IS NOT NULL AND TRIM(email) <> ''
     )`
  ).then((row) => row.count);
}

async function sendMarketingCampaign(db, campaignId) {
  if (!unsubscribeSecret()) {
    const error = new Error('Email sending requires SESSION_SECRET to protect unsubscribe links.');
    error.statusCode = 503;
    throw error;
  }

  const claim = await run(
    db,
    `UPDATE marketing_campaigns
     SET status = 'sending', last_error = NULL
     WHERE id = ? AND status IN ('draft', 'scheduled')`,
    [campaignId]
  );
  if (!claim.changes) {
    const error = new Error('This campaign has already been sent, cancelled or is currently processing.');
    error.statusCode = 409;
    throw error;
  }

  try {
    const campaign = await get(db, 'SELECT * FROM marketing_campaigns WHERE id = ?', [campaignId]);
    if (!campaign) throw new Error('The saved campaign could not be found.');

    const recipientRows = await all(
      db,
      `SELECT * FROM (
         SELECT id, email, marketing_consent_at, 'user' AS source
         FROM users
         WHERE marketing_consent = 1 AND marketing_consent_at IS NOT NULL
           AND email IS NOT NULL AND TRIM(email) <> ''
         UNION ALL
         SELECT id, email, consented_at AS marketing_consent_at, 'subscriber' AS source
         FROM marketing_subscribers
         WHERE consented_at IS NOT NULL AND unsubscribed_at IS NULL
           AND email IS NOT NULL AND TRIM(email) <> ''
       )
       ORDER BY CASE WHEN source = 'user' THEN 0 ELSE 1 END, id`
    );
    const uniqueRecipients = new Map();
    for (const recipient of recipientRows) {
      const emailKey = recipient.email.trim().toLowerCase();
      if (!uniqueRecipients.has(emailKey)) uniqueRecipients.set(emailKey, recipient);
    }
    const recipients = [...uniqueRecipients.values()];

    if (!recipients.length) {
      await run(
        db,
        `UPDATE marketing_campaigns
         SET status = 'failed', recipient_count = 0, last_error = ?
         WHERE id = ?`,
        ['No opted-in subscribers at send time.', campaignId]
      );
      const error = new Error('There are no opted-in email subscribers at send time.');
      error.statusCode = 400;
      throw error;
    }

    const { transporter } = require('./email');
    const baseUrl = (process.env.APP_URL || 'https://apexingoodcompany.co.uk').replace(/\/+$/, '');
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'support@apexingoodcompany.co.uk';
    let sentCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      const stillSubscribed = recipient.source === 'subscriber'
        ? await get(
          db,
          `SELECT id FROM marketing_subscribers
           WHERE id = ? AND email = ? AND consented_at = ? AND unsubscribed_at IS NULL`,
          [recipient.id, recipient.email, recipient.marketing_consent_at]
        )
        : await get(
          db,
          `SELECT id FROM users
           WHERE id = ? AND email = ? AND marketing_consent = 1 AND marketing_consent_at = ?`,
          [recipient.id, recipient.email, recipient.marketing_consent_at]
        );
      if (!stillSubscribed) continue;

      try {
        const token = createUnsubscribeToken(
          recipient.id,
          recipient.marketing_consent_at,
          recipient.source
        );
        const unsubscribeUrl = `${baseUrl}/unsubscribe/${encodeURIComponent(token)}`;
        const safeBody = escapeHtml(campaign.body).replace(/\r?\n/g, '<br>');
        await transporter.sendMail({
          from,
          to: recipient.email,
          subject: campaign.subject,
          text: `${campaign.body}\n\nUnsubscribe from Apex Moto & Co marketing emails: ${unsubscribeUrl}`,
          html: `<div>${safeBody}</div><hr><p style="font-size:12px;color:#666">You received this marketing email because you opted in to Apex Moto & Co updates. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>.</p>`,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          }
        });
        sentCount += 1;
      } catch (error) {
        failureCount += 1;
        console.error(`Marketing campaign ${campaignId} failed to deliver to a subscriber.`);
      }
    }

    const status = sentCount === 0 ? 'failed' : failureCount > 0 ? 'partial' : 'sent';
    const lastError = status === 'failed'
      ? 'No messages were delivered. The audience may have unsubscribed or SMTP delivery failed.'
      : failureCount > 0
        ? 'Some messages could not be delivered.'
        : null;

    await run(
      db,
      `UPDATE marketing_campaigns
       SET status = ?, recipient_count = ?, sent_count = ?, failure_count = ?,
           last_error = ?, sent_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'sending'`,
      [status, recipients.length, sentCount, failureCount, lastError, campaignId]
    );
    return { status, recipientCount: recipients.length, sentCount, failureCount };
  } catch (error) {
    await run(
      db,
      `UPDATE marketing_campaigns
       SET status = 'failed', last_error = ?
       WHERE id = ? AND status = 'sending'`,
      [error.statusCode ? error.message : 'The campaign could not be sent. Check the email server configuration.', campaignId]
    );
    throw error;
  }
}

async function sendDueMarketingCampaigns(db) {
  const campaigns = await all(
    db,
    `SELECT id FROM marketing_campaigns
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND datetime(scheduled_at) <= CURRENT_TIMESTAMP
     ORDER BY scheduled_at, id
     LIMIT 10`
  );

  for (const campaign of campaigns) {
    try {
      await sendMarketingCampaign(db, campaign.id);
    } catch (error) {
      if (error.statusCode !== 409) {
        console.error(`Scheduled marketing campaign ${campaign.id} failed:`, error.message);
      }
    }
  }
}

module.exports = {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  getOptedInRecipientCount,
  sendMarketingCampaign,
  sendDueMarketingCampaigns
};
