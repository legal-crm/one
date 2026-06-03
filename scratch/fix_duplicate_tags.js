import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/components/AdminRole.tsx');

// We restore from Git first to ensure we have a clean baseline of the file with the patched billing tab.
// Since the previous run modified the file, let's read the current content, but we know it has the duplicate </div>.
// Instead of restoring from git, we can just search for the duplicate pattern:
// "            </div>\n          )}\n\n            </div>\n          )}"
// Let's read the file:
let content = fs.readFileSync(filePath, 'utf-8');

// Let's replace the duplicate block with a single block:
const duplicateBlock = `            </div>
          )}

            </div>
          )}`;

const correctBlock = `            </div>
          )}`;

if (content.includes(duplicateBlock)) {
  content = content.replace(duplicateBlock, correctBlock);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Fixed duplicate closing tags successfully!");
} else {
  console.log("Duplicate block not found, let's clean from git and do it cleanly.");
}
