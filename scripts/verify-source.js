
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const targets = ['index.js', 'commands', 'events', 'utils'];
const badPatterns = [/^<<<<<<< /m, /^=======$/m, /^>>>>>>> /m, /^@@\s-\d+/m];

function walk(filePath, list = []) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      walk(path.join(filePath, entry), list);
    }
    return list;
  }

  if (filePath.endsWith('.js')) list.push(filePath);
  return list;
}

const files = targets.flatMap((target) => walk(path.join(ROOT, target)));
const failedFiles = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (badPatterns.some((pattern) => pattern.test(content))) {
    failedFiles.push(path.relative(ROOT, file));
  }
}

if (failedFiles.length > 0) {
  console.error('Kaynak dosyalarda patch/conflict kalıntısı bulundu:');
  for (const file of failedFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('Kaynak dosya doğrulaması başarılı.');
