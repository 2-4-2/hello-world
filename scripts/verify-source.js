const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const targets = ['index.js', 'src', 'commands', 'events', 'utils'];
const badPatterns = [/^<<<<<<< /m, /^=======$/m, /^>>>>>>> /m, /^@@\s-\d+/m];

function walk(filePath, list = []) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) walk(path.join(filePath, entry), list);
    return list;
  }
  if (filePath.endsWith('.js')) list.push(filePath);
  return list;
}

const files = targets.flatMap((target) => walk(path.join(ROOT, target)));
const issues = [];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  for (const pattern of badPatterns) {
    if (pattern.test(content)) {
      issues.push(`${relative} -> patch/conflict kalıntısı: ${pattern}`);
      break;
    }
  }
