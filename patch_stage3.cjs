const fs = require('fs');
const filePath = 'c:\\Users\\JSH\\Downloads\\legal-crm---회생파산-상담-플랫폼\\src\\components\\lawyer\\pipeline\\Stage3DocumentsHubView.tsx';

let content = fs.readFileSync(filePath, 'utf8');

const startTag = "{/* ══════════════════════════════════════════════════════════════\n          SECTION 1: 발급 서류 (docs)\n          ══════════════════════════════════════════════════════════════ */}";
const endTag = "{/* ══════════════════════════════════════════════════════════════\n          SECTION 2: 부채증명서 (debt-cert)\n          ══════════════════════════════════════════════════════════════ */}";

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end tag.");
  process.exit(1);
}

const replacement = `      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: 발급 서류 (docs)
          ══════════════════════════════════════════════════════════════ */}
      {currentSection === 'docs' && (
        <div className="space-y-5 animate-fadeIn">
          {/* 체크리스트 우선 뷰 카드 */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* 상단 진행률 및 헤더 */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-indigo-600" />
                  {clientRequest.clientName} · 신청서류
                </h3>
                
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    <span className="text-emerald-600">{stats.approvedCount}</span>
                    <span className="text-slate-400">/</span>
                    <span>{stats.total} 받음</span>
                  </div>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: \`\${stats.total > 0 ? (stats.approvedCount / stats.total) * 100 : 0}%\` }}
                    />
                  </div>
                  {stats.submittedCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold whitespace-nowrap">
                      확인 필요 {stats.submittedCount}건
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#163152] text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 press-scale whitespace-nowrap min-h-[44px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>의뢰인에게 요청 보내기</span>
                </button>
              </div>
            </div>

            {/* 필터 툴바 */}
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 min-h-[44px]"
              >
                <option value="auto">급여소득자 기본 ▾</option>
                <option value="manual1">영업소득자 기본 ▾</option>
              </select>

              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="서류명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 min-h-[44px]"
                />
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all press-scale whitespace-nowrap min-h-[44px]">
                + 추가
              </button>
              
              <div className="ml-auto flex items-center gap-2">
                 <button
                  type="button"
                  onClick={() => setShowPublicDocGuide(true)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 press-scale min-h-[44px]"
                  title="8대 공공기관별 필수 발급 옵션 및 의뢰인 전송용 문자 템플릿 확인"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">공공기관 발급 가이드</span>
                </button>
              </div>
            </div>

            {/* 체크리스트 테이블 */}
            <div className="divide-y divide-slate-100 bg-white">
              <div className="grid grid-cols-12 gap-3 px-5 py-2 bg-slate-50/50 text-xs font-bold text-slate-500">
                <div className="col-span-1 text-center">번호</div>
                <div className="col-span-6">서류명</div>
                <div className="col-span-3 text-center">발급 안내</div>
                <div className="col-span-2 text-center">수령 상태</div>
              </div>

              {filteredDocs.filter(d => d.name.includes(searchQuery)).map((doc, idx) => {
                const isExpanded = expandedDocId === doc.id;
                
                return (
                  <div key={doc.id} className="flex flex-col border-b border-slate-100 last:border-b-0">
                    <div 
                      className={\`grid grid-cols-12 gap-3 px-5 py-3 items-center cursor-pointer hover:bg-slate-50 transition-colors \${isExpanded ? 'bg-slate-50' : ''}\`}
                      onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                    >
                      <div className="col-span-1 text-center text-slate-400 font-mono text-xs font-medium">
                        {idx + 1}
                      </div>
                      
                      <div className="col-span-6 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{doc.name}</span>
                          {doc.isRequired && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              필수
                            </span>
                          )}
                          {doc.phase === 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              실물 등기
                            </span>
                          )}
                        </div>
                        {doc.status !== 'APPROVED' && doc.status !== 'NOT_REQUESTED' && (
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                            <span className={\`font-medium \${
                              doc.status === 'SUBMITTED' ? 'text-blue-600' :
                              doc.status === 'SUPPLEMENT_NEEDED' ? 'text-amber-600' :
                              doc.status === 'REQUESTED' ? 'text-indigo-600' : 'text-slate-500'
                            }\`}>
                              {doc.status === 'SUBMITTED' ? '업로드됨 · 확인 필요' :
                               doc.status === 'SUPPLEMENT_NEEDED' ? '보완 필요' :
                               doc.status === 'REQUESTED' ? '요청함 (미제출)' : ''}
                            </span>
                            {doc.supplementReason && (
                              <span className="text-slate-500 truncate max-w-[200px]">- {doc.supplementReason}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-3 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPublicDocGuide(true); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          안내 보기 <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (doc.status === 'APPROVED') {
                              setDocList(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'NOT_REQUESTED' } : d));
                            } else {
                              handleApproveDoc(doc.id);
                            }
                          }}
                          className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 \${
                            doc.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-slate-200'
                          }\`}
                        >
                          <span
                            className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${
                              doc.status === 'APPROVED' ? 'translate-x-6' : 'translate-x-1'
                            }\`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 행 확장 시 보이는 세부 정보 패널 */}
                    {isExpanded && (
                      <div className="px-12 py-4 bg-slate-50/80 border-t border-slate-100 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> 상세 정보
                              </h5>
                              <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-500 w-16 shrink-0">발급처</span>
                                  <span className="font-medium text-slate-800">{doc.agency}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-500 w-16 shrink-0">메모</span>
                                  <span className="text-slate-700">{doc.notes || '-'}</span>
                                </div>
                                {doc.isThirdPartyMaskingRequired && (
                                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold shrink-0">
                                      마스킹 필수
                                    </span>
                                    <span className="text-slate-600 text-[11px]">제3자 주민등록번호 뒷자리 마스킹 처리 요망</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {doc.status === 'SUBMITTED' && (
                               <button
                                  type="button"
                                  onClick={() => setShowSpeedReviewModal(true)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer press-scale"
                                >
                                  <FileCheck2 className="w-4 h-4" />
                                  <span>제출된 파일 검토하기</span>
                                </button>
                            )}
                          </div>
                          
                          <div>
                            <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" /> 파일 직접 업로드
                            </h5>
                            <div className="bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                              <SmartDocumentDropzone
                                clientId={clientRequest.id}
                                clientName={clientRequest.clientName || '의뢰인'}
                                compact={true}
                                targetDocId={doc.id}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 2열 요약 카드 (1차 서류 배송 및 보관 & 인증서 금고) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 카드 A: 1차 실물 서류 & 인감 수령 상태 */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={\`w-8 h-8 rounded-xl flex items-center justify-center \${
                      stats.isPhase1Done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }\`}>
                      <Truck className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">1차 실물 서류 & 인감</h4>
                      <p className="text-[12px] text-slate-500">인감도장 및 인감증명서 원본 수령</p>
                    </div>
                  </div>
                  <span className={\`px-2.5 py-1 rounded-lg text-xs font-bold border \${
                    stats.isPhase1Done
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }\`}>
                    {stats.isPhase1Done ? '수령 완료' : \`\${stats.phase1ApprovedCount}/\${stats.phase1RequiredCount}건 준비 중\`}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Stamp className="w-3.5 h-3.5 text-indigo-600" /> 인감도장 사무소 금고 보관:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSealKeptInSafe(!isSealKeptInSafe)}
                      className={\`px-2.5 py-0.5 rounded-lg font-bold transition-all cursor-pointer \${
                        isSealKeptInSafe 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                          : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300'
                      }\`}
                    >
                      {isSealKeptInSafe ? '보관 중' : '미수령 (클릭하여 확인)'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">인감증명서 필수 부수:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      채권사 {creditorCount}곳 + 5부 = <strong className="text-indigo-600">총 {requiredSealCount}부 필수</strong>
                    </span>
                  </div>

                  {/* 배송 송장정보 한 줄 */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> 등기/택배 배송:
                    </span>
                    {isEditingPostal ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={inputCarrier}
                          onChange={(e) => setInputCarrier(e.target.value)}
                          className="text-xs bg-white border border-slate-300 rounded-lg p-1"
                        >
                          {CARRIER_LIST.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={inputTracking}
                          onChange={(e) => setInputTracking(e.target.value)}
                          placeholder="송장번호"
                          className="w-28 text-xs bg-white border border-slate-300 rounded-lg p-1 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleSavePostalTracking}
                          className="px-2 py-1 bg-[#1E3A5F] text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-800">
                          [{getCarrierLabel(postalCarrier)}] {postalTrackingNumber || '미등록'}
                        </span>
                        {postalTrackingNumber && getCarrierTrackingUrl(postalCarrier, postalTrackingNumber) && (
                          <a
                            href={getCarrierTrackingUrl(postalCarrier, postalTrackingNumber)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100"
                          >
                            조회
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setInputCarrier(postalCarrier);
                            setInputTracking(postalTrackingNumber);
                            setIsEditingPostal(true);
                          }}
                          className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApproveAllPhase1}
                  className={\`flex-1 py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale min-h-[44px] \${
                    stats.isPhase1Done
                      ? 'bg-slate-100 text-emerald-800 border border-emerald-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }\`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{stats.isPhase1Done ? '1차 서류 수령완료됨' : '1차 서류 일괄 수령확인'}</span>
                </button>
              </div>
            </div>

            {/* 카드 B: 인증서 금고 연동 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              <CertificateVaultCard
                clientId={clientRequest.id}
                clientRequest={clientRequest}
                crmExt={crmExt}
                onUpdateCrmExt={onUpdateCrmExt}
                compact={true}
              />
            </div>
          </div>

          {/* 하단 라이트 단계 완료 조건 바 */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={\`w-2.5 h-2.5 rounded-full \${stats.isReadyForStage4 ? 'bg-emerald-600' : 'bg-amber-500'}\`} />
              <span className="font-bold text-slate-900">3단계 완료 조건:</span>
              <span className="text-slate-600">
                필수 서류 승인율 80% 이상 & 검토 대기 0건 ({stats.approvedCount}/{stats.requiredCount}건 승인됨, 검토 대기 {stats.submittedCount}건)
              </span>
            </div>

            {stats.isReadyForStage4 ? (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
              >
                <span>다음: 4단계 (신청·접수)로 이동</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : stats.submittedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowSpeedReviewModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>제출 서류 {stats.submittedCount}건 빠른 검토</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>미제출 서류 묶음 요청</span>
              </button>
            )}
          </div>
        </div>
      )}
`;

const newContent = content.substring(0, startIndex) + replacement + "\n" + content.substring(endIndex);
fs.writeFileSync(filePath, newContent);
console.log("Successfully replaced docs section.");
