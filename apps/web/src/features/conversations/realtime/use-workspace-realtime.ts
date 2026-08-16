import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AgentPresenceDto,
  AgentPresenceStatus,
  RealtimeClientMessage,
  RealtimeServerMessage,
  RealtimeSupportEvent,
} from '@ai-customer-support/contracts';
import { useAuthStore } from '@/features/identity/auth-store';
import { queryKeys } from '@/services/query-keys';

export type ConversationTyping = {
  readonly conversationId: string;
  readonly actorId: string;
  readonly actorType: 'agent' | 'customer';
  readonly displayName: string;
};

export type WorkspaceRealtime = {
  readonly connected: boolean;
  readonly presence: readonly AgentPresenceDto[];
  readonly ownStatus: AgentPresenceStatus;
  readonly typing: readonly ConversationTyping[];
  setOwnStatus: (status: Exclude<AgentPresenceStatus, 'offline'>) => void;
  sendTyping: (conversationId: string, active: boolean) => void;
  typingFor: (conversationId: string) => readonly ConversationTyping[];
};

const RECONNECT_MS = 2_000;

export function useWorkspaceRealtime(organizationId: string, enabled: boolean): WorkspaceRealtime {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<AgentPresenceDto[]>([]);
  const [ownStatus, setOwnStatusState] = useState<AgentPresenceStatus>('offline');
  const userId = useAuthStore((state) => state.user?.id);
  const [typing, setTyping] = useState<ConversationTyping[]>([]);

  const send = useCallback((message: RealtimeClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId) {
      return;
    }

    let closed = false;
    let reconnectTimer: number | undefined;

    function connect(): void {
      if (closed) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/api/organizations/${organizationId}/realtime`,
      );
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        setConnected(true);
      });

      socket.addEventListener('message', (event) => {
        const message = parseServerMessage(event.data);
        if (!message) {
          return;
        }

        if (message.type === 'connected') {
          window.clearInterval(heartbeatRef.current);
          heartbeatRef.current = window.setInterval(() => {
            send({ type: 'heartbeat' });
          }, message.heartbeatIntervalMs);
          return;
        }

        if (message.type === 'presence.snapshot') {
          setPresence([...message.items]);
          return;
        }

        if (message.type === 'event') {
          applySupportEvent(message.event);
          return;
        }

        if (message.type === 'typing') {
          setTyping((current) => upsertTyping(current, message));
          return;
        }

        if (message.type === 'assignee_presence') {
          setPresence((current) =>
            current.map((item) =>
              item.agentId === message.agentId ? { ...item, status: message.status } : item,
            ),
          );
        }
      });

      socket.addEventListener('close', () => {
        setConnected(false);
        window.clearInterval(heartbeatRef.current);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
        }
      });

      socket.addEventListener('error', () => {
        socket.close();
      });
    }

    function applySupportEvent(event: RealtimeSupportEvent): void {
      if (event.name === 'agent.presence_changed') {
        const agentId = typeof event.payload.agentId === 'string' ? event.payload.agentId : undefined;
        const status = isPresenceStatus(event.payload.status) ? event.payload.status : undefined;
        if (!agentId || !status) {
          return;
        }

        setPresence((current) =>
          current.map((item) => (item.agentId === agentId ? { ...item, status } : item)),
        );
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
    }

    connect();

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, organizationId, queryClient, send]);

  const setOwnStatus = useCallback(
    (status: Exclude<AgentPresenceStatus, 'offline'>) => {
      setOwnStatusState(status);
      send({ type: 'presence.set', status });
    },
    [send],
  );

  const sendTyping = useCallback(
    (conversationId: string, active: boolean) => {
      send(active ? { type: 'typing.start', conversationId } : { type: 'typing.stop', conversationId });
    },
    [send],
  );

  const typingFor = useCallback(
    (conversationId: string) => typing.filter((item) => item.conversationId === conversationId),
    [typing],
  );

  const resolvedOwnStatus =
    presence.find((item) => item.agentId === userId)?.status ?? ownStatus;

  return useMemo(
    () => ({
      connected,
      presence,
      ownStatus: resolvedOwnStatus,
      typing,
      setOwnStatus,
      sendTyping,
      typingFor,
    }),
    [connected, resolvedOwnStatus, presence, sendTyping, setOwnStatus, typing, typingFor],
  );
}

function upsertTyping(
  current: readonly ConversationTyping[],
  message: Extract<RealtimeServerMessage, { type: 'typing' }>,
): ConversationTyping[] {
  const without = current.filter(
    (item) => !(item.conversationId === message.conversationId && item.actorId === message.actorId),
  );
  if (!message.active) {
    return without;
  }

  return [
    ...without,
    {
      conversationId: message.conversationId,
      actorId: message.actorId,
      actorType: message.actorType,
      displayName: message.displayName,
    },
  ];
}

function parseServerMessage(raw: unknown): RealtimeServerMessage | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as RealtimeServerMessage;
    return parsed && typeof parsed === 'object' && 'type' in parsed ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isPresenceStatus(value: unknown): value is AgentPresenceStatus {
  return value === 'online' || value === 'away' || value === 'busy' || value === 'offline';
}
