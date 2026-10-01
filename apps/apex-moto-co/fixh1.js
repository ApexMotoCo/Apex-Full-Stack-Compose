const fs = require('fs');
const fix = 'display: block !important; width: 100% !important; max-width: none !important; margin-left: auto !important; margin-right: auto !important; text-align: center !important; ';
const targets = [
  ['views/detailing/index.ejs', '<h1 style="text-transform: uppercase;'],
  ['views/detailing/services.ejs', '<h1 id="servicing-title" style="text-transform: uppercase;']
];
for (const [file, tag] of targets) {
  let text = fs.readFileSync(file, 'utf8');
  const count = text.split(tag).length - 1;
  if (count !== 1) { console.log(file + ': expected 1 match, found ' + count + ' - not changed'); continue; }
  text = text.replace(tag, tag.replace('style="', 'style="' + fix));
  fs.writeFileSync(file, text);
  console.log(file + ': updated');
}
