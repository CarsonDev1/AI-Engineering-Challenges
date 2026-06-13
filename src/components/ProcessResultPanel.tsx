'use client';

import { Alert, Tag } from 'antd';
import type { ProcessClaimResult } from '@/lib/engine/process-claim';

const EVENT_LABELS: Record<string, string> = {
  claim_submitted: 'Claim submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  payment_sent: 'Payment sent',
};

// Renders the runtime engine's verdict for a claim: either the structured errors (as an
// alert, never a crash) or the five outputs — documents, approval routing, notifications,
// SLA deadline, escalation. Pure presentation of a ProcessClaimResult, so preview and the
// demo page render identical results from the same /api/process-claim response.
export function ProcessResultPanel({
  result,
  businessDays,
}: {
  result: ProcessClaimResult;
  businessDays?: number;
}) {
  if (!result.ok) {
    return (
      <div className="result-panel" data-testid="process-result">
        <Alert
          type="error"
          showIcon
          message="This claim cannot be processed"
          description={
            <ul className="result-errors">
              {result.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          }
        />
      </div>
    );
  }

  return (
    <div className="result-panel" data-testid="process-result">
      <section className="result-block">
        <h3 className="result-block__title">Approval routing</h3>
        {result.approval.route === 'AUTO_APPROVED' ? (
          <span className="result-badge result-badge--auto" data-testid="approval-route">
            Auto-approved
          </span>
        ) : (
          <span className="result-badge result-badge--manual" data-testid="approval-route">
            Manual review&nbsp;·&nbsp;<strong>{result.approval.role}</strong>
            <span className="muted">&nbsp;(tier {result.approval.tierIndex + 1})</span>
          </span>
        )}
      </section>

      <section className="result-block">
        <h3 className="result-block__title">Required documents</h3>
        {result.requiredDocuments.length > 0 ? (
          <ul className="result-list">
            {result.requiredDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">None required.</p>
        )}
        {result.optionalDocuments.length > 0 && (
          <>
            <h4 className="result-block__subtitle">Optional</h4>
            <ul className="result-list result-list--muted">
              {result.optionalDocuments.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="result-block">
        <h3 className="result-block__title">Notifications</h3>
        <div className="result-notifs">
          {result.notifications.map((n) => (
            <div className="result-notif" key={n.event}>
              <span className="result-notif__event">{EVENT_LABELS[n.event] ?? n.event}</span>
              <span className="result-notif__channels">
                {n.channels.map((c) => (
                  <Tag key={c}>{c}</Tag>
                ))}
              </span>
              <span className="muted result-notif__tpl">{n.template} template</span>
            </div>
          ))}
        </div>
      </section>

      <section className="result-block">
        <h3 className="result-block__title">SLA deadline</h3>
        <p>
          <span className="font-mono result-sla" data-testid="sla-deadline">
            {result.slaDeadline}
          </span>
          {businessDays != null && (
            <span className="muted">&nbsp;·&nbsp;{businessDays} business days</span>
          )}
        </p>
      </section>

      <section className="result-block">
        <h3 className="result-block__title">Escalation</h3>
        <p className="muted">
          If the SLA deadline passes, notify <strong>{result.escalation.notifyRole}</strong>.
        </p>
      </section>
    </div>
  );
}
