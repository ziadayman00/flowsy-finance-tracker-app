import { Module } from '@nestjs/common';
import { NoopNotificationAdapter } from './noop-notification.adapter';

export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';

/**
 * NotificationsModule wires the active NotificationProvider adapter.
 *
 * Currently registers NoopNotificationAdapter. To swap in a real provider:
 *
 *   1. Create your adapter class implementing NotificationProvider.
 *   2. Replace `useClass: NoopNotificationAdapter` below.
 *   3. Import this module in any feature module that needs to send notifications.
 *
 * Injection example in a service:
 *   @Inject(NOTIFICATION_PROVIDER)
 *   private readonly notifications: NotificationProvider
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_PROVIDER,
      useClass: NoopNotificationAdapter,
    },
  ],
  exports: [NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
