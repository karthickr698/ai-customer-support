import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ConversationDto,
  MessageAttachmentDto,
  MessageDto,
  PublicWidgetConfigurationDto,
  WidgetSessionDto,
} from '@ai-customer-support/contracts';
import { WidgetApi } from '../api/client';
import { isWidgetApiError } from '../api/errors';
import type { WidgetBootConfig } from '../boot';
import { postLayout } from '../protocol';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from '../storage';
import { applyWidgetTheme, contrastForeground, normalizeHexColor } from '../theme';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

export type WidgetPhase = 'bootstrapping' | 'identify' | 'ready' | 'disabled' | 'error';

export type PendingAttachment = {
  readonly id: string;
  readonly file: File;
};

export type WidgetController = {
  readonly phase: WidgetPhase;
  readonly open: boolean;
  readonly mobile: boolean;
  readonly config: PublicWidgetConfigurationDto | null;
  readonly session: WidgetSessionDto | null;
  readonly conversation: ConversationDto | null;
  readonly messages: readonly MessageDto[];
  readonly streamingText: string;
  readonly typing: boolean;
  readonly sending: boolean;
  readonly error: string | null;
  readonly pendingFiles: readonly PendingAttachment[];
  readonly composer: string;
  readonly identifyName: string;
  readonly identifyEmail: string;
  readonly reducedMotion: boolean;
  setOpen: (open: boolean) => void;
  setComposer: (value: string) => void;
  setIdentifyName: (value: string) => void;
  setIdentifyEmail: (value: string) => void;
  submitIdentify: () => Promise<void>;
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  send: () => Promise<void>;
  submitFeedback: (messageId: string, rating: 'helpful' | 'not_helpful') => Promise<void>;
  attachmentHref: (attachment: MessageAttachmentDto) => Promise<string>;
  startNewConversation: () => Promise<void>;
};

export function useWidget(boot: WidgetBootConfig): WidgetController {
  const [phase, setPhase] = useState<WidgetPhase>('bootstrapping');
  const [open, setOpenState] = useState(boot.startOpen);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [config, setConfig] = useState<PublicWidgetConfigurationDto | null>(null);
  const [session, setSession] = useState<WidgetSessionDto | null>(null);
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [composer, setComposer] = useState('');
  const [identifyName, setIdentifyName] = useState('');
  const [identifyEmail, setIdentifyEmail] = useState('');
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const tokenRef = useRef<string | null>(readStoredSession(boot.publicKey)?.sessionToken ?? null);
  const conversationIdRef = useRef<string | null>(readStoredSession(boot.publicKey)?.conversationId ?? null);
  const blobUrls = useRef<string[]>([]);
  const api = useMemo(
    () => new WidgetApi(boot.apiBase, () => tokenRef.current),
    [boot.apiBase],
  );

  const persist = useCallback(() => {
    if (!tokenRef.current) {
      return;
    }

    writeStoredSession(boot.publicKey, {
      sessionToken: tokenRef.current,
      conversationId: conversationIdRef.current,
    });
  }, [boot.publicKey]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  const applyTheme = useCallback(
    (widget: PublicWidgetConfigurationDto) => {
      const primary = normalizeHexColor(boot.primaryColor ?? widget.primaryColor);
      applyWidgetTheme(document.documentElement, {
        primary,
        primaryForeground: contrastForeground(primary),
        position: boot.position ?? widget.position,
      });
    },
    [boot.position, boot.primaryColor],
  );

  const ensureConversation = useCallback(async (): Promise<ConversationDto> => {
    if (conversation) {
      return conversation;
    }

    const created = await api.startConversation();
    conversationIdRef.current = created.conversation.id;
    setConversation(created.conversation);
    persist();
    return created.conversation;
  }, [api, conversation, persist]);

  const bootstrapSession = useCallback(
    async (widget: PublicWidgetConfigurationDto, identity?: { email: string; name: string }) => {
      const stored = readStoredSession(boot.publicKey);
      if (stored?.sessionToken && !identity) {
        tokenRef.current = stored.sessionToken;
        try {
          const me = await api.getSession();
          setSession(me.session);
          const listed = await api.listConversations();
          const existing =
            listed.items.find((item) => item.id === stored.conversationId) ??
            listed.items.find((item) => item.status === 'open') ??
            listed.items[0];
          if (existing) {
            conversationIdRef.current = existing.id;
            setConversation(existing);
            const history = await api.listMessages(existing.id);
            setMessages([...history.items]);
            persist();
          }
          setPhase('ready');
          return;
        } catch {
          tokenRef.current = null;
          conversationIdRef.current = null;
          clearStoredSession(boot.publicKey);
        }
      }

      if (!identity && !widget.allowAnonymous) {
        setPhase('identify');
        return;
      }

      const created = await api.createSession(boot.publicKey, {
        visitorId: visitorId(boot.publicKey),
        email: identity?.email,
        name: identity?.name,
      });
      tokenRef.current = created.sessionToken;
      setSession(created.session);
      persist();
      setPhase('ready');
    },
    [api, boot.publicKey, persist],
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMedia = () => {
      setMobile(media.matches);
    };
    const onMotion = () => {
      setReducedMotion(motion.matches);
    };
    media.addEventListener('change', onMedia);
    motion.addEventListener('change', onMotion);
    return () => {
      media.removeEventListener('change', onMedia);
      motion.removeEventListener('change', onMotion);
    };
  }, []);

  useEffect(() => {
    const position = boot.position ?? config?.position ?? 'right';
    postLayout(window.parent, { type: 'layout', open, mobile, position, unread: 0 });
  }, [boot.position, config?.position, mobile, open]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string };
      if (data?.source !== 'acs-host') {
        return;
      }

      if (data.type === 'open') {
        setOpenState(true);
      } else if (data.type === 'close') {
        setOpenState(false);
      } else if (data.type === 'toggle') {
        setOpenState((current) => !current);
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    const urls = blobUrls.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!boot.publicKey) {
      setError('This widget is missing a public key.');
      setPhase('error');
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await api.getConfig(boot.publicKey, controller.signal);
        applyTheme(response.widget);
        setConfig(response.widget);
        if (!response.widget.enabled) {
          setPhase('disabled');
          return;
        }

        await bootstrapSession(response.widget);
      } catch (caught: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setError(isWidgetApiError(caught) ? caught.message : 'Unable to load the support widget.');
        setPhase('error');
      }
    })();

    return () => {
      controller.abort();
    };
  }, [api, applyTheme, boot.publicKey, bootstrapSession]);

  const submitIdentify = useCallback(async () => {
    if (!config) {
      return;
    }

    const email = identifyEmail.trim();
    const name = identifyName.trim();
    if (!email || !name) {
      setError('Enter your name and email to start chatting.');
      return;
    }

    setError(null);
    try {
      if (tokenRef.current) {
        const identified = await api.identify({ email, name });
        setSession(identified.session);
        setPhase('ready');
        return;
      }

      await bootstrapSession(config, { email, name });
    } catch (caught: unknown) {
      setError(isWidgetApiError(caught) ? caught.message : 'Unable to start a chat session.');
    }
  }, [api, bootstrapSession, config, identifyEmail, identifyName]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    setPendingFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`You can attach up to ${String(MAX_ATTACHMENTS)} files.`);
          break;
        }

        if (!ALLOWED_TYPES.has(file.type)) {
          setError('Attachments must be PNG, JPEG, WebP, GIF, PDF, or plain text.');
          continue;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError('Each attachment must be 5MB or smaller.');
          continue;
        }

        next.push({ id: crypto.randomUUID(), file });
      }

      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const send = useCallback(async () => {
    const body = composer.trim();
    if ((!body && pendingFiles.length === 0) || sending) {
      return;
    }

    if (config && !config.allowAttachments && pendingFiles.length > 0) {
      setError('Attachments are disabled for this widget.');
      return;
    }

    setSending(true);
    setError(null);
    setTyping(config?.aiEnabled ?? true);
    setStreamingText('');

    try {
      const active = await ensureConversation();
      const attachmentIds: string[] = [];
      for (const pending of pendingFiles) {
        const uploaded = await api.uploadAttachment(active.id, pending.file);
        attachmentIds.push(uploaded.attachment.id);
      }

      setComposer('');
      setPendingFiles([]);

      for await (const event of api.streamReply(active.id, {
        body: body || undefined,
        attachmentIds,
      })) {
        if (event.type === 'message') {
          setConversation(event.conversation);
          setMessages((current) => mergeMessage(current, event.message));
          continue;
        }

        if (event.type === 'typing') {
          setTyping(event.active);
          continue;
        }

        if (event.type === 'delta') {
          setTyping(false);
          setStreamingText((current) => current + event.text);
          continue;
        }

        if (event.type === 'error') {
          setError(event.message);
          continue;
        }

        if (event.type === 'done') {
          setConversation(event.conversation);
          setStreamingText('');
          setTyping(false);
          const completed = event.message;
          if (completed) {
            setMessages((current) => mergeMessage(current, completed));
          }
        }
      }
    } catch (caught: unknown) {
      setError(isWidgetApiError(caught) ? caught.message : 'Unable to send your message.');
      setTyping(false);
      setStreamingText('');
    } finally {
      setSending(false);
    }
  }, [api, composer, config, ensureConversation, pendingFiles, sending]);

  const submitFeedback = useCallback(
    async (messageId: string, rating: 'helpful' | 'not_helpful') => {
      const conversationId = conversationIdRef.current;
      if (!conversationId) {
        return;
      }

      try {
        const result = await api.submitFeedback(conversationId, messageId, { rating });
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId ? { ...message, feedback: result.feedback } : message,
          ),
        );
      } catch (caught: unknown) {
        setError(isWidgetApiError(caught) ? caught.message : 'Unable to save feedback.');
      }
    },
    [api],
  );

  const attachmentHref = useCallback(
    async (attachment: MessageAttachmentDto) => {
      const conversationId = conversationIdRef.current ?? attachment.conversationId;
      const blob = await api.downloadAttachment(conversationId, attachment.id);
      const url = URL.createObjectURL(blob);
      blobUrls.current.push(url);
      return url;
    },
    [api],
  );

  const startNewConversation = useCallback(async () => {
    const created = await api.startConversation();
    conversationIdRef.current = created.conversation.id;
    setConversation(created.conversation);
    setMessages([]);
    persist();
  }, [api, persist]);

  return {
    phase,
    open,
    mobile,
    config,
    session,
    conversation,
    messages,
    streamingText,
    typing,
    sending,
    error,
    pendingFiles,
    composer,
    identifyName,
    identifyEmail,
    reducedMotion,
    setOpen,
    setComposer,
    setIdentifyName,
    setIdentifyEmail,
    submitIdentify,
    addFiles,
    removeFile,
    send,
    submitFeedback,
    attachmentHref,
    startNewConversation,
  };
}

function mergeMessage(messages: readonly MessageDto[], incoming: MessageDto): MessageDto[] {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages.map((message) => (message.id === incoming.id ? incoming : message));
  }

  return [...messages, incoming];
}

function visitorId(publicKey: string): string {
  const key = `acs.widget.${publicKey}.visitor`;
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}
