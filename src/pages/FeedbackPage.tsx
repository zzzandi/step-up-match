import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAccessSession,
} from "@/auth/access";
import {
  createFeedback,
  deleteFeedback,
  deleteFeedbackRevision,
  getFeedbackList,
  updateFeedback,
} from "@/services/feedbackService";
import type {
  FeedbackRevision,
  UserFeedback,
} from "@/types/feedback";

function formatKstDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function getRevisionLabel(
  revision: FeedbackRevision
) {
  if (
    revision.action === "CREATED"
  ) {
    return "작성";
  }

  if (
    revision.action === "UPDATED"
  ) {
    return "수정";
  }

  return "삭제";
}

export default function FeedbackPage() {
  const session = useAccessSession();
  const [feedbackList, setFeedbackList] =
    useState<UserFeedback[]>([]);
  const [draft, setDraft] =
    useState("");
  const [
    editingFeedbackId,
    setEditingFeedbackId,
  ] = useState("");
  const [editingContent, setEditingContent] =
    useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const isMaster =
    session?.role === "MASTER";

  const visibleFeedbackList =
    useMemo(
      () =>
        isMaster
          ? feedbackList
          : feedbackList.filter(
              (feedback) =>
                !feedback.deletedAt
            ),
      [feedbackList, isMaster]
    );

  async function loadFeedback() {
    if (!session) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const items =
        await getFeedbackList(
          session
        );
      setFeedbackList(items);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "피드백을 불러오지 못했습니다. Supabase 테이블 설정을 확인해 주세요."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadFeedback();
      }, 0);

    return () =>
      window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session?.role,
    session?.userId,
    session?.userName,
  ]);

  async function handleCreate() {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await createFeedback({
        session,
        content: draft,
      });
      setDraft("");
      setMessage(
        "피드백을 저장했습니다."
      );
      await loadFeedback();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "피드백 저장에 실패했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(
    feedbackId: string
  ) {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await updateFeedback({
        session,
        id: feedbackId,
        content: editingContent,
      });
      setEditingFeedbackId("");
      setEditingContent("");
      setMessage(
        "피드백을 수정했습니다."
      );
      await loadFeedback();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "피드백 수정에 실패했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(
    feedbackId: string
  ) {
    if (!session) {
      return;
    }

    if (
      !window.confirm(
        "이 피드백을 삭제하시겠습니까? 마스터에게는 삭제 이력이 남습니다."
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await deleteFeedback({
        session,
        id: feedbackId,
      });
      setMessage(
        "피드백을 삭제했습니다."
      );
      await loadFeedback();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "피드백 삭제에 실패했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteRevision({
    feedbackId,
    revisionId,
  }: {
    feedbackId: string;
    revisionId: string;
  }) {
    if (
      !session ||
      session.role !== "MASTER"
    ) {
      return;
    }

    if (
      !window.confirm(
        "이 수정·삭제 이력을 삭제하시겠습니까? 피드백 본문은 유지됩니다."
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await deleteFeedbackRevision({
        session,
        feedbackId,
        revisionId,
      });
      setMessage(
        "피드백 이력을 삭제했습니다."
      );
      await loadFeedback();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "피드백 이력 삭제에 실패했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-screen-md space-y-4">
        <section>
          <div className="text-sm font-black uppercase tracking-wide text-cyan-300">
            FEEDBACK
          </div>
          <h1 className="mt-2 text-3xl font-black">
            앱 피드백
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            앱을 사용하면서 불편한 점, 개선 아이디어, 오류 제보를 남길 수 있습니다.
            작성한 피드백은 본인과 마스터만 확인할 수 있습니다.
          </p>
        </section>

        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
          <div className="font-bold text-cyan-100">
            새 피드백 남기기
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            운동 중이 아니어도 언제든 남길 수 있고, 운동이 종료되어도 기록은 유지됩니다.
          </p>
          <textarea
            value={draft}
            onChange={(event) =>
              setDraft(
                event.target.value
              )
            }
            maxLength={1200}
            placeholder="예: 대기열 휴식시간이 이상하게 보였어요 / 리포트에 이런 항목이 있으면 좋겠어요"
            className="mt-3 h-36 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-300"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {draft.length}/1200
            </span>
            <button
              type="button"
              onClick={() =>
                void handleCreate()
              }
              disabled={
                isSaving ||
                !draft.trim()
              }
              className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              피드백 저장
            </button>
          </div>
        </section>

        {(message ||
          errorMessage) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              errorMessage
                ? "border-red-300/30 bg-red-500/10 text-red-100"
                : "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
            }`}
          >
            {errorMessage ||
              message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-100">
                {isMaster
                  ? "전체 피드백"
                  : "내 피드백"}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {isMaster
                  ? "마스터는 전체 피드백과 수정·삭제 이력을 확인할 수 있습니다."
                  : "내가 작성한 피드백만 표시됩니다."}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void loadFeedback()
              }
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200"
            >
              새로고침
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="rounded-xl bg-slate-950/70 p-4 text-sm text-slate-400">
                피드백을 불러오는 중입니다.
              </div>
            ) : visibleFeedbackList.length ===
              0 ? (
              <div className="rounded-xl bg-slate-950/70 p-4 text-sm text-slate-400">
                아직 표시할 피드백이 없습니다.
              </div>
            ) : (
              visibleFeedbackList.map(
                (feedback) => {
                  const isOwner =
                    feedback.authorId ===
                    (session.userId ??
                      `${session.role}:${session.userName ?? "unknown"}`);
                  const isEditing =
                    editingFeedbackId ===
                    feedback.id;

                  return (
                    <article
                      key={feedback.id}
                      className={`rounded-xl border p-4 ${
                        feedback.deletedAt
                          ? "border-amber-300/30 bg-amber-300/10"
                          : "border-slate-800 bg-slate-950/70"
                      }`}
                    >
                      <div className="flex flex-col gap-1 text-xs text-slate-400">
                        <div className="font-bold text-slate-200">
                          {feedback.authorName}
                          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                            {feedback.isGuest
                              ? "GUEST"
                              : feedback.authorRole}
                          </span>
                          {feedback.deletedAt && (
                            <span className="ml-2 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-950">
                              삭제됨
                            </span>
                          )}
                        </div>
                        <div>
                          작성{" "}
                          {formatKstDateTime(
                            feedback.createdAt
                          )}
                          {" · "}수정{" "}
                          {formatKstDateTime(
                            feedback.updatedAt
                          )}
                          {feedback.deletedAt &&
                            ` · 삭제 ${formatKstDateTime(feedback.deletedAt)}`}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3">
                          <textarea
                            value={
                              editingContent
                            }
                            onChange={(
                              event
                            ) =>
                              setEditingContent(
                                event.target
                                  .value
                              )
                            }
                            maxLength={1200}
                            className="h-32 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-300"
                          />
                          <div className="mt-2 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFeedbackId(
                                  ""
                                );
                                setEditingContent(
                                  ""
                                );
                              }}
                              className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdate(
                                  feedback.id
                                )
                              }
                              disabled={
                                isSaving ||
                                !editingContent.trim()
                              }
                              className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              수정 저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                          {feedback.content}
                        </p>
                      )}

                      {isOwner &&
                        !feedback.deletedAt &&
                        !isEditing && (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFeedbackId(
                                  feedback.id
                                );
                                setEditingContent(
                                  feedback.content
                                );
                              }}
                              className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  feedback.id
                                )
                              }
                              className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        )}

                      {isMaster && (
                        <details className="mt-3 rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
                          <summary className="cursor-pointer font-bold text-cyan-200">
                            수정·삭제 이력{" "}
                            {
                              feedback
                                .revisions
                                .length
                            }
                            건
                          </summary>
                          <div className="mt-3 space-y-2">
                            {feedback.revisions
                              .length ===
                            0 ? (
                              <div className="text-slate-500">
                                기록이 없습니다.
                              </div>
                            ) : (
                              feedback.revisions.map(
                                (
                                  revision
                                ) => (
                                  <div
                                    key={
                                      revision.id
                                    }
                                    className="rounded-lg border border-slate-800 bg-slate-950 p-2"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="font-bold text-slate-100">
                                        {getRevisionLabel(
                                          revision
                                        )}{" "}
                                        ·{" "}
                                        {formatKstDateTime(
                                          revision.changedAt
                                        )}{" "}
                                        ·{" "}
                                        {
                                          revision.editorName
                                        }
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleDeleteRevision(
                                            {
                                              feedbackId:
                                                feedback.id,
                                              revisionId:
                                                revision.id,
                                            }
                                          )
                                        }
                                        disabled={
                                          isSaving
                                        }
                                        className="self-start rounded-lg border border-red-300/40 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        이력 삭제
                                      </button>
                                    </div>
                                    {revision.previousContent && (
                                      <div className="mt-2 text-slate-500">
                                        이전:{" "}
                                        {
                                          revision.previousContent
                                        }
                                      </div>
                                    )}
                                    {revision.nextContent && (
                                      <div className="mt-1 text-slate-300">
                                        이후:{" "}
                                        {
                                          revision.nextContent
                                        }
                                      </div>
                                    )}
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </details>
                      )}
                    </article>
                  );
                }
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
