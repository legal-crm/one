import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/components/AdminRole.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// We find the corrupted part:
// "<h2 className=\"text-xl font-black text-white\">?달 멤버??구독 매" (or whatever encoding version)
// Let's use a dynamic search. We know it starts with "MONTHLY PLATFORM REVENUE SUMMARY" and then "text-xl font-black text-white"
const keyword = 'MONTHLY PLATFORM REVENUE SUMMARY';
const keyIndex = content.indexOf(keyword);
if (keyIndex === -1) {
  console.error("Keyword 'MONTHLY PLATFORM REVENUE SUMMARY' not found!");
  process.exit(1);
}

// Find the start of the <h2 tag inside that block
const h2StartIndex = content.indexOf('<h2 className="text-xl font-black text-white">', keyIndex);
if (h2StartIndex === -1) {
  console.error("H2 tag not found!");
  process.exit(1);
}

// Find the target tab 5 contents start
const contentsTabIndex = content.indexOf("{/* TAB 5: SITE CONTENT CRUD OPERATIONS */}");
if (contentsTabIndex === -1) {
  console.error("TAB 5 not found!");
  process.exit(1);
}

const activeTabContentsStart = content.indexOf("{activeTab === 'contents' && (", contentsTabIndex);
if (activeTabContentsStart === -1) {
  console.error("activeTab === 'contents' start not found!");
  process.exit(1);
}

console.log("Found indices - h2Start:", h2StartIndex, "activeTabContentsStart:", activeTabContentsStart);

// We want to replace everything from h2StartIndex to activeTabContentsStart with the correct code
const before = content.substring(0, h2StartIndex);
const after = content.substring(activeTabContentsStart);

const replacement = `<h2 className="text-xl font-black text-white">이달 멤버십 구독 매출 정산: <span className="text-indigo-400">{estimateMRR.toLocaleString()} 원</span></h2>
                    <p className="text-xs text-slate-400">회생파산 플랫폼은 변호사법을 완벽히 준수하여 정액 광고 구독 수입 모델로만 매출을 창출합니다.</p>
                  </div>
                </div>
  
                {/* Transactions grid */}
                <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider">구독료 징수 현황 명세 (실시간 업데이트)</h3>
                  
                  <div className="overflow-x-auto rounded-xl border border-[#1E293B]/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161B26] text-slate-400 font-bold border-b border-[#1E293B]/60">
                          <th className="p-3">정산 대상 변호사</th>
                          <th className="p-3">구독료 멤버십</th>
                          <th className="p-3">월 고정 징수액</th>
                          <th className="p-3">수납 상태</th>
                          <th className="p-3 text-right">플랫폼 실적</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/30">
                        {lawyers.map(l => {
                          let planName = 'Basic';
                          let planPrice = '300,000 원';
                          if (l.matchedCount > 120) {
                            planName = 'Team / Enterprise';
                            planPrice = '1,500,000 원';
                          } else if (l.matchedCount > 80) {
                            planName = 'Pro';
                            planPrice = '800,000 원';
                          }
                          return (
                            <tr key={l.id} className="hover:bg-[#0B0F19]/20">
                              <td className="p-3 font-bold text-white flex items-center gap-1.5">
                                <img src={l.avatar} alt={l.name} className="w-5 h-5 rounded-full object-cover" />
                                <span>{l.name}</span>
                              </td>
                              <td className="p-3">{planName}</td>
                              <td className="p-3 font-semibold text-indigo-400">{planPrice}</td>
                              <td className="p-3">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded flex items-center gap-1 w-max">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>정상수납</span>
                                </span>
                              </td>
                              <td className="p-3 text-right text-slate-350">{l.matchedCount}회 매칭참여</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
  
            {/* TAB 5: SITE CONTENT CRUD OPERATIONS */}
            `;

fs.writeFileSync(filePath, before + replacement + after, 'utf-8');
console.log("Patched billing tab successfully!");
