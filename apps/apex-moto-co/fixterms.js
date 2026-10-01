const fs = require('fs');
const file = process.argv[2] || 'views/terms.ejs';
let t = fs.readFileSync(file, 'utf8');
const need = (ok, msg) => { if (!ok) { console.log('NOT CHANGED: ' + msg); process.exit(1); } };

const callRe = /\(settings\.(\w*content\w*)\s*\|\|\s*''\)/g;
const calls = t.match(callRe) || [];
need(calls.length === 1, 'expected 1 stored-content line, found ' + calls.length);
const field = /settings\.(\w+)/.exec(calls[0])[1];

const topRe = /<p[^>]*>Last Updated: <%= new Date\(\)[^%]*%><\/p>/;
const endRe = /(<\/div>\s*<\/main>)(?![\s\S]*<\/main>)/;
const mainRe = /<main[^>]*>/g;
need(topRe.test(t), 'could not find the top Last Updated line');
need(endRe.test(t), 'could not find the end of the page');
need((t.match(mainRe) || []).length === 1, 'expected exactly one <main> tag');

const head = `<%
  const pageRaw = String(settings.${field} || '');
  let pageUpdated = '';
  let pageTagline = '';
  const pageKept = [];
  pageRaw.split(/\\r?\\n/).forEach(line => {
    const plain = line.replace(/\\*/g, '').trim();
    if (/^last updated/i.test(plain)) { pageUpdated = plain; return; }
    if (/in good company/i.test(plain)) { pageTagline = plain; return; }
    if (/^[-_]{3,}$/.test(plain)) return;
    pageKept.push(line.replace(/\\*/g, ''));
  });
  const pageBody = pageKept.join('\\n').replace(/\\n{3,}/g, '\\n\\n').replace(/\\s+$/, '');
%>
`;

const foot = `
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #333; text-align: center; color: var(--text-muted);">
            <% if (pageTagline) { %><p style="margin: 0 0 8px; font-weight: 600;"><%= pageTagline %></p><% } %>
            <% if (pageUpdated) { %><p style="margin: 0; font-size: 14px;"><%= pageUpdated %></p><% } %>
        </div>
    `;

t = t.replace(calls[0], () => '(pageBody)');
t = t.replace(topRe, () => '<div style="margin-bottom: 30px;"></div>');
t = t.replace(endRe, (m) => foot + m);
t = t.replace(mainRe, (m) => head + m);
fs.writeFileSync(file, t);
console.log(file + ' updated (content field: ' + field + ')');
