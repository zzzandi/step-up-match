import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import type {
  AccessRole,
} from "@/auth/access";
import type {
  LiveStatePatch,
  LiveStateSnapshot,
} from "@/services/liveStateSync";
import type {
  Player,
} from "@/types/player";

const CLIENT_ID =
  crypto.randomUUID();

export function getLiveSessionClientId() {
  return CLIENT_ID;
}

export type LiveSessionEvent =
  | {
      type: "WORKOUT_OPENED";
      workoutDate: string;
    }
  | {
      type: "WORKOUT_CLOSED";
      workoutDate: string;
    }
  | {
      type: "END_TODAY";
      reason:
        | "MIDNIGHT"
        | "ADMIN_END";
    }
  | {
      type: "FORCE_LOGOUT";
      userId?: string;
      reason:
        | "LEFT"
        | "END_TODAY";
    }
  | {
      type: "PARTICIPANT_ACTIVATED";
      player: Player;
      sourceUserId: string;
      sourceClientId: string;
      sentAt: string;
    }
  | {
      type: "STATE_SNAPSHOT";
      snapshot: LiveStateSnapshot;
      sourceRole: AccessRole;
      sourceUserId?: string;
      sourceClientId: string;
      sentAt: string;
      patch?: LiveStatePatch;
      responseToRequestId?: string;
    }
  | {
      type: "REQUEST_SNAPSHOT";
      requestId: string;
    }
  | {
      type: "STATE_CHANGED";
    };

type Listener = (
  event: LiveSessionEvent
) => void;

const CHANNEL_NAME =
  "step-up-match-live-session";
const EVENT_NAME =
  "live-session-event";
const LOCAL_EVENT_NAME =
  "step-up-match-live-session-local";

let channel:
  | ReturnType<
      typeof supabase.channel
    >
  | null = null;
let channelSubscribed = false;
let channelSubscribeStarted = false;
let pendingRemoteEvents: LiveSessionEvent[] =
  [];

function sendRemoteEvent(
  event: LiveSessionEvent
) {
  const currentChannel =
    ensureChannel();

  if (
    !currentChannel ||
    !channelSubscribed
  ) {
    pendingRemoteEvents.push(event);
    return;
  }

  void currentChannel.send({
    type: "broadcast",
    event: EVENT_NAME,
    payload: event,
  });
}

function flushPendingRemoteEvents() {
  const currentChannel =
    ensureChannel();

  if (
    !currentChannel ||
    !channelSubscribed ||
    pendingRemoteEvents.length === 0
  ) {
    return;
  }

  const events =
    pendingRemoteEvents.slice();
  pendingRemoteEvents = [];

  events.forEach(sendRemoteEvent);
}

function ensureChannel() {
  if (
    !isSupabaseConfigured ||
    channel
  ) {
    return channel;
  }

  channel =
    supabase.channel(
      CHANNEL_NAME
    );

  return channel;
}

function ensureSubscribed() {
  const currentChannel =
    ensureChannel();

  if (
    !currentChannel ||
    channelSubscribeStarted
  ) {
    return;
  }

  channelSubscribeStarted = true;
  currentChannel.subscribe((status) => {
    channelSubscribed =
      status === "SUBSCRIBED";

    if (channelSubscribed) {
      flushPendingRemoteEvents();
    }
  });
}

export function publishLiveSessionEvent(
  event: LiveSessionEvent
) {
  window.dispatchEvent(
    new CustomEvent(
      LOCAL_EVENT_NAME,
      {
        detail: event,
      }
    )
  );

  ensureSubscribed();
  sendRemoteEvent(event);
}

export function subscribeLiveSessionEvents(
  listener: Listener
) {
  const localHandler = (
    event: Event
  ) => {
    listener(
      (
        event as CustomEvent<LiveSessionEvent>
      ).detail
    );
  };

  window.addEventListener(
    LOCAL_EVENT_NAME,
    localHandler
  );

  const currentChannel =
    ensureChannel();

  currentChannel?.on(
    "broadcast",
    {
      event: EVENT_NAME,
    },
    (payload) => {
      listener(
        payload.payload as LiveSessionEvent
      );
    }
  );
  ensureSubscribed();

  return () => {
    window.removeEventListener(
      LOCAL_EVENT_NAME,
      localHandler
    );

    if (currentChannel) {
      supabase.removeChannel(
        currentChannel
      );
      channel = null;
      channelSubscribed = false;
      channelSubscribeStarted = false;
      pendingRemoteEvents = [];
    }
  };
}
