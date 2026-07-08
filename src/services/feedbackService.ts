import type {
  AccessSession,
} from "@/auth/access";
import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import type {
  FeedbackRevision,
  UserFeedback,
} from "@/types/feedback";

const TABLE = "user_feedback";

interface FeedbackRow {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  is_guest: boolean;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revisions: FeedbackRevision[] | null;
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }
}

export function getFeedbackAuthorId(
  session: AccessSession
) {
  return (
    session.userId ??
    `${session.role}:${session.userName ?? "unknown"}`
  );
}

function getFeedbackAuthorName(
  session: AccessSession
) {
  return (
    session.userName ??
    (session.isGuest
      ? "게스트"
      : "이름 없음")
  );
}

function normalizeFeedbackRow(
  row: FeedbackRow
): UserFeedback {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole:
      row.author_role === "MASTER" ||
      row.author_role === "ADMIN" ||
      row.author_role === "PLAYER"
        ? row.author_role
        : "PLAYER",
    isGuest: row.is_guest,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    revisions: Array.isArray(row.revisions)
      ? row.revisions
      : [],
  };
}

function createRevision({
  action,
  session,
  previousContent,
  nextContent,
}: {
  action: FeedbackRevision["action"];
  session: AccessSession;
  previousContent?: string;
  nextContent?: string;
}): FeedbackRevision {
  return {
    id:
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`,
    action,
    changedAt: new Date().toISOString(),
    editorId: getFeedbackAuthorId(session),
    editorName: getFeedbackAuthorName(session),
    previousContent,
    nextContent,
  };
}

async function getFeedbackById(
  id: string
) {
  ensureConfigured();

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, author_id, author_name, author_role, is_guest, content, created_at, updated_at, deleted_at, revisions"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? normalizeFeedbackRow(
        data as FeedbackRow
      )
    : null;
}

function assertCanModifyFeedback(
  feedback: UserFeedback,
  session: AccessSession
) {
  if (
    feedback.authorId !==
    getFeedbackAuthorId(session)
  ) {
    throw new Error(
      "본인이 작성한 피드백만 수정하거나 삭제할 수 있습니다."
    );
  }
}

export async function getFeedbackList(
  session: AccessSession
) {
  ensureConfigured();

  let query = supabase
    .from(TABLE)
    .select(
      "id, author_id, author_name, author_role, is_guest, content, created_at, updated_at, deleted_at, revisions"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(300);

  if (session.role !== "MASTER") {
    query = query.eq(
      "author_id",
      getFeedbackAuthorId(session)
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    normalizeFeedbackRow(
      row as FeedbackRow
    )
  );
}

export async function createFeedback({
  session,
  content,
}: {
  session: AccessSession;
  content: string;
}) {
  ensureConfigured();

  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error(
      "피드백 내용을 입력해 주세요."
    );
  }

  const now = new Date().toISOString();
  const id =
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  const revisions = [
    createRevision({
      action: "CREATED",
      session,
      nextContent: trimmed,
    }),
  ];

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id,
      author_id:
        getFeedbackAuthorId(session),
      author_name:
        getFeedbackAuthorName(session),
      author_role: session.role,
      is_guest: session.isGuest === true,
      content: trimmed,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      revisions,
    })
    .select(
      "id, author_id, author_name, author_role, is_guest, content, created_at, updated_at, deleted_at, revisions"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeFeedbackRow(
    data as FeedbackRow
  );
}

export async function updateFeedback({
  session,
  id,
  content,
}: {
  session: AccessSession;
  id: string;
  content: string;
}) {
  const feedback =
    await getFeedbackById(id);

  if (!feedback) {
    throw new Error(
      "피드백을 찾을 수 없습니다."
    );
  }

  assertCanModifyFeedback(
    feedback,
    session
  );

  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error(
      "피드백 내용을 입력해 주세요."
    );
  }

  const now = new Date().toISOString();
  const revisions = [
    ...feedback.revisions,
    createRevision({
      action: "UPDATED",
      session,
      previousContent:
        feedback.content,
      nextContent: trimmed,
    }),
  ];

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      content: trimmed,
      updated_at: now,
      revisions,
    })
    .eq("id", id)
    .select(
      "id, author_id, author_name, author_role, is_guest, content, created_at, updated_at, deleted_at, revisions"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeFeedbackRow(
    data as FeedbackRow
  );
}

export async function deleteFeedback({
  session,
  id,
}: {
  session: AccessSession;
  id: string;
}) {
  const feedback =
    await getFeedbackById(id);

  if (!feedback) {
    throw new Error(
      "피드백을 찾을 수 없습니다."
    );
  }

  assertCanModifyFeedback(
    feedback,
    session
  );

  const now = new Date().toISOString();
  const revisions = [
    ...feedback.revisions,
    createRevision({
      action: "DELETED",
      session,
      previousContent:
        feedback.content,
    }),
  ];

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      deleted_at: now,
      updated_at: now,
      revisions,
    })
    .eq("id", id)
    .select(
      "id, author_id, author_name, author_role, is_guest, content, created_at, updated_at, deleted_at, revisions"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeFeedbackRow(
    data as FeedbackRow
  );
}
