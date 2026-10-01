const fs = require('fs');
const file = 'views/privacy.ejs';
let t = fs.readFileSync(file, 'utf8');
const need = (ok, msg) => { if (!ok) { console.log('NOT CHANGED: ' + msg); process.exit(1); } };

const head = String.raw`<%
  const privacyRaw = String(settings.privacy_content || '');
  let privacyUpdated = '';
  let privacyTagline = '';
  const privacyKept = [];
  privacyRaw.split(/\r?\n/).forEach(line => {
    const plain = line.replace(/\*/g, '').trim();
    if (/^last updated/i.test(plain)) { privacyUpdated = plain; return; }
    if (/in good company/i.test(plain)) { privacyTagline = plain; return; }
    if (/^[-_]{3,}$/.test(plain)) return;
    privacyKept.push(line.replace(/\*/g, ''));
  });
  const privacyBody = privacyKept.join('\n').replace(/\s+$/, '');
%>
`;

const foot = String.raw`
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #333; text-align: center; color: var(--text-muted);">
            <% if (privacyTagline) { %><p style="margin: 0 0 8px; font-weight: 600;"><%= privacyTagline %></p><% } %>
            <% if (privacyUpdated) { %><p style="margin: 0; font-size: 14px;"><%= privacyUpdated %></p><% } %>
        </div>
    `;

const bodyCall = "(settings.privacy_content || '')";
const topRe = /<p[^>]*>Last Updated: <%= new Date\(\)[^%]*%><\/p>/;
const endRe = /(<\/section>\s*)(<\/div>\s*<\/main>)/;
const mainTag = '<main class="container">';

need(t.split(bodyCall).length - 1 === 1, 'could not find the privacy content line exactly once');
need(topRe.test(t), 'could not find the top Last Updated line');
need(endRe.test(t), 'could not find the end of the page');
need(t.split(mainTag).length - 1 === 1, 'could not find the main tag exactly once');

t = t.replace(bodyCall, () => '(privacyBody)');
t = t.replace(topRe, () => '<div style="margin-bottom: 30px;"></div>');
t = t.replace(endRe, (m, a, b) => a + foot + b);
t = t.replace(mainTag, () => head + mainTag);
fs.writeFileSync(file, t);
console.log('privacy.ejs updated');
