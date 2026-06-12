'use client';

import { Checkbox, Input, Switch } from 'antd';
import { CHANNELS, NOTIFICATION_EVENTS, type TenantConfig } from '@/lib/config/schema';
import { FieldError } from './Field';
import type { Issue } from './issues';

type Notifications = TenantConfig['notifications'];
type EventKey = (typeof NOTIFICATION_EVENTS)[number];
type EventConfig = NonNullable<Notifications[EventKey]>;

export function NotificationsTab({
  value,
  onChange,
  issues,
}: {
  value: Notifications;
  onChange: (v: Notifications) => void;
  issues: Issue[];
}) {
  // Enabling an event the tenant never configured starts with zero channels — the
  // inline "needs at least one channel" error makes the admin choose explicitly.
  const setEvent = (ev: EventKey, patch: Partial<EventConfig>) => {
    const existing = value[ev] ?? { enabled: false, channels: [] };
    onChange({ ...value, [ev]: { ...existing, ...patch } });
  };

  return (
    <div className="editor-pane">
      {NOTIFICATION_EVENTS.map((ev) => {
        const cfg = value[ev];
        return (
          <div className="notif-row" key={ev}>
            <div className="notif-row__head">
              <span className="font-mono">{ev}</span>
              <Switch
                aria-label={`Enable ${ev}`}
                checked={!!cfg?.enabled}
                onChange={(checked) => setEvent(ev, { enabled: checked })}
              />
            </div>
            {cfg?.enabled && (
              <div className="notif-row__body">
                <Checkbox.Group
                  aria-label={`${ev} channels`}
                  options={[...CHANNELS]}
                  value={cfg.channels}
                  onChange={(channels) => setEvent(ev, { channels: channels as EventConfig['channels'] })}
                />
                <Input.TextArea
                  aria-label={`${ev} email template`}
                  rows={2}
                  placeholder="Custom email template — leave empty to send the default template"
                  value={cfg.emailTemplate ?? ''}
                  onChange={(e) => setEvent(ev, { emailTemplate: e.target.value || undefined })}
                />
                <FieldError issues={issues} path={['notifications', ev]} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
