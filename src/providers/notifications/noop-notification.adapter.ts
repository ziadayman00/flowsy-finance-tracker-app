import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
} from './notification.provider.interface';

/**
 * Noop notification adapter — logs the notification but does not deliver it.
 *
 * Registered as the active NotificationProvider when no real provider is
 * configured. All channels return accepted: false with a clear message.
 * This ensures the application boots cleanly without a push/email/SMS backend.
 *
 * To connect a real provider:
 * 1. Create an adapter: e.g. `class FirebaseCloudMessagingAdapter implements NotificationProvider`
 * 2. Replace `useClass: NoopNotificationAdapter` in NotificationsModule.
 * 3. Inject ConfigService to read the API key from environment variables.
 * 4. Write unit tests with mocked FCM/SendGrid/etc. HTTP responses.
 *
 * Candidate providers for the Egypt/Gulf market:
 * - Push: Firebase Cloud Messaging (FCM) — works globally, free tier sufficient.
 * - Email: SendGrid, Amazon SES, Postmark.
 * - SMS: Twilio (verify Egypt local number support), Vonage, Unifonic (Gulf-focused).
 *
 * NOTE: Verify that your chosen SMS provider supports Egypt (+20) and Gulf
 * country codes before committing to it.
 */
@Injectable()
export class NoopNotificationAdapter implements NotificationProvider {
  readonly providerName = 'noop-stub';
  readonly supportedChannels: ReadonlySet<NotificationChannel> = new Set([
    'push', 'email', 'sms', 'in-app',
  ]);

  private readonly logger = new Logger(NoopNotificationAdapter.name);

  async notify(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.debug(
      `[noop] Would deliver notification to user ${payload.userId}: "${payload.title}". ` +
        'No notification provider is configured.',
    );

    return {
      accepted: false,
      providerName: this.providerName,
      channelResults: payload.channels.map((channel) => ({
        channel,
        accepted: false,
        error: 'No notification provider configured.',
      })),
    };
  }
}
