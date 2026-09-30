import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, inputClass } from '../ui';
import { cn } from '../../../utils/cn';
import type { MyPageModel } from './useMyPageModel';

/**
 * 의뢰인 전달사항 메모 (MyPageView에서 분리)
 * - 입력란에 이름(라벨), 수정·삭제 아이콘 버튼에 이름과 44px 누름 영역 (이전: title만 있는 22px 버튼)
 */
export default function ClientNotesEditor({ vm }: { vm: MyPageModel }) {
  const {
    editingNoteIndex, editingNoteValue, handleAddMypageNote, handleDeleteMypageNote, handleSaveMypageNote,
    newNoteInput, profile, setEditingNoteIndex, setEditingNoteValue, setNewNoteInput,
  } = vm;
  if (!profile) return null;
  const notes: string[] = profile.clientNotes || [];
  return (
    <div className="space-y-3 pt-3 border-t border-slate-200 text-left">
      <h4 id="client-notes-title" className="text-sm font-bold text-slate-700 border-l-2 border-brand pl-2">
        변호사에게 전달할 메모
      </h4>

      {/* 입력 및 추가 */}
      <div className="flex gap-2">
        <label htmlFor="client-note-new" className="sr-only">
          변호사에게 전달할 메모 입력
        </label>
        <input
          id="client-note-new"
          type="text"
          value={newNoteInput}
          onChange={(e) => setNewNoteInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleAddMypageNote();
            }
          }}
          placeholder="변호사에게 전달하고 싶은 특이사항이나 질문"
          className={cn(inputClass, 'flex-1')}
        />
        <Button onClick={handleAddMypageNote} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} className="shrink-0">
          추가
        </Button>
      </div>

      {/* 등록된 메모 목록 */}
      {notes.length > 0 ? (
        <ul className="space-y-2" aria-labelledby="client-notes-title">
          {notes.map((note, index) => (
            <li key={index} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3 text-sm">
              {editingNoteIndex === index ? (
                <div className="flex flex-1 flex-wrap gap-2">
                  <label htmlFor={`client-note-edit-${index}`} className="sr-only">
                    메모 {index + 1} 수정
                  </label>
                  <input
                    id={`client-note-edit-${index}`}
                    type="text"
                    value={editingNoteValue}
                    onChange={(e) => setEditingNoteValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSaveMypageNote(index);
                      }
                    }}
                    className={cn(inputClass, 'min-w-0 flex-1')}
                    autoFocus
                  />
                  <Button onClick={() => handleSaveMypageNote(index)} className="shrink-0">
                    저장
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingNoteIndex(null)} className="shrink-0">
                    취소
                  </Button>
                </div>
              ) : (
                <>
                  <span className="min-w-0 break-all leading-relaxed text-slate-900">{note}</span>
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteIndex(index);
                        setEditingNoteValue(note);
                      }}
                      aria-label={`메모 ${index + 1} 수정`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMypageNote(index)}
                      aria-label={`메모 ${index + 1} 삭제`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-4 text-center text-sm text-slate-600">
          등록된 메모가 없어요. 변호사에게 전달할 내용을 적어 두면 상담할 때 함께 확인해요.
        </p>
      )}
    </div>
  );
}
