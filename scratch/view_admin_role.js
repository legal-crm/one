const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminRole.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let output = '';
const start = 900;
const end = lines.length;
for (let i = start; i <= end; i++) {
  output += `${i}: ${lines[i - 1]}\n`;
}

fs.writeFileSync(path.join(__dirname, 'extracted.txt'), output, 'utf8');
console.log('Done!');
