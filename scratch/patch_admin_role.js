import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/components/AdminRole.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const targetIndex = content.indexOf('          )}assName="p-3">');
if (targetIndex === -1) {
  console.error("Target string not found!");
  process.exit(1);
}

console.log("Target found at index:", targetIndex);

const cleanContent = content.substring(0, targetIndex);

const suffix = `          )}

            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="bg-[#161B26] border-t border-[#1E293B]/60 text-center py-4 text-[10px] text-slate-500">
          <p>© 2026 회생 및 파산 전문 어드민 관리센터. All rights reserved.</p>
        </footer>

      </div>
    </div>
  );
}
`;

fs.writeFileSync(filePath, cleanContent + suffix, 'utf-8');
console.log("Patched successfully!");
