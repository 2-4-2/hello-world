const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const targets = ['index.js', 'commands', 'events', 'utils'];
const markerPatterns = [/^<<<<<<< /m, /^=======$/m, /^>>>>>>> /m, /^@@\s-\d+/m];
const markerLine = /^(<<<<<<< |=======|>>>>>>> |@@\s-\d+)/;

function walk(filePath, list = []) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) walk(path.join(filePath, entry), list);
    return list;
  }
  if (filePath.endsWith('.js')) list.push(filePath);
  return list;
}

function sanitizePatchMarkers(content) {
  const lines = content.split('\n');
  const cleaned = lines.filter((line) => !markerLine.test(line));
  const changed = cleaned.length !== lines.length;
  return { changed, content: cleaned.join('\n') };
}

const files = targets.flatMap((target) => walk(path.join(ROOT, target)));
const issues = [];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  let content = fs.readFileSync(file, 'utf8');

  if (markerPatterns.some((pattern) => pattern.test(content))) {
    const sanitized = sanitizePatchMarkers(content);
    if (sanitized.changed) {
      fs.writeFileSync(file, sanitized.content, 'utf8');
      content = sanitized.content;
      console.warn(`Patch/conflict satırları temizlendi: ${relative}`);
    }
  }

  try {
    new vm.Script(content, { filename: relative });
  } catch (error) {
    issues.push(`${relative} -> JavaScript parse hatası: ${error.message}`);
  }
}

if (issues.length > 0) {
  console.error('Kaynak dosya doğrulaması başarısız:');
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Kaynak dosya doğrulaması başarılı.');
