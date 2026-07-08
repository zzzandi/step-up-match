import type {
  AccessRole,
} from "@/auth/access";

export type FeedbackRevisionAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED";

export interface FeedbackRevision {
  id: string;
  action: FeedbackRevisionAction;
  changedAt: string;
  editorId: string;
  editorName: string;
  previousContent?: string;
  nextContent?: string;
}

export interface UserFeedback {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: AccessRole;
  isGuest: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  revisions: FeedbackRevision[];
}
