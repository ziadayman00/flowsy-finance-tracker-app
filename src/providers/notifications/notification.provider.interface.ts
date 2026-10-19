/**
 * Provider-independent notification delivery interface.
 *
 * Design rules:
 * - This interface is the ONLY contract the application depends on.
 *   Push, email, and SMS adapters implement it independently.
 * - Notification delivery is best-effort and must never block a financial operation.
 *   Always call notify() asynchronously and catch errors separately.
 * - At-least-once delivery is the goal; implement idempotency keys to prevent
 *   duplicate notifications if the provider retries or the job is replayed.
 * - Never store provider credentials in source code.
 * - Notification content must not include PII beyond what is necessary.
 *   Do not include account balances, transaction amounts, or passwords in
 *   notification payloads sent over untrusted channels (SMS, email subject lines).
 */

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in-app';

export interface NotificationPayload {
  /** Target user ID in the Flowsy system (never an external ID). */
  userId: string;

  /** Notification title (shown as the push notification title or email subject). */
  title: string;

  /**
   * Notification body.
   * Keep this concise. Do NOT include sensitive financial data (balances,
   * card numbers) in SMS or email subjects — those channels are not secure.
   */
  body: string;

  /**
   * Optional deep-link data for mobile apps.
   * Example: { screen: 'CommitmentDetail', commitmentId: 'xyz' }
   */
  data?: Record<string, string>;

  /**
   * Idempotency key. The provider implementation should use this to prevent
   * duplicate delivery if the same notification is submitted more than once
   * (e.g. due to a job retry after a transient failure).
   */
  idempotencyKey?: string;

  /** Delivery channel(s) to use. */
  channels: NotificationChannel[];
}

export interface NotificationResult {
  /** Whether the notification was accepted by the provider (not necessarily delivered). */
  accepted: boolean;

  /** Per-channel delivery status. */
  channelResults: {
    channel: NotificationChannel;
    accepted: boolean;
    providerMessageId?: string;
    error?: string;
  }[];

  providerName: string;
}

export interface NotificationProvider {
  /**
   * Delivers a notification to the specified user via the requested channel(s).
   *
   * Implementations MUST:
   * - Never throw for non-critical delivery failures — return accepted: false instead.
   * - Log delivery failures with the correlationId/idempotencyKey for traceability.
   * - Respect the idempotencyKey to prevent duplicate delivery on retries.
   * - Never block the calling request — this should be called fire-and-forget
   *   or from a background queue in production.
   *
   * @throws only for configuration errors (missing API key, invalid channel).
   */
  notify(payload: NotificationPayload): Promise<NotificationResult>;

  /** The canonical name of this provider (for logs and audit). */
  readonly providerName: string;

  /** Channels this provider can deliver to. */
  readonly supportedChannels: ReadonlySet<NotificationChannel>;
}
