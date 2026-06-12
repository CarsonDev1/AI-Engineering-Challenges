'use client';

import { useState } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { defaultTenantConfig } from '@/lib/config/default-config';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

// Asks only for a name + slug, then posts a minimal valid default config — onboarding a
// new tenant is pure configuration, zero code. Slug uniqueness (409) surfaces inline.
export function CreateTenantModal({ open, onClose, onCreated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string; slug: string }>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: values.slug, name: values.name, config: defaultTenantConfig(values.name) }),
      });
      if (res.status === 409) {
        form.setFields([{ name: 'slug', errors: ['That slug is already taken.'] }]);
        return;
      }
      if (!res.ok) {
        message.error('Could not create the tenant.');
        return;
      }
      message.success(`Tenant “${values.name}” created.`);
      form.resetFields();
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="New tenant"
      open={open}
      onOk={submit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okText="Create tenant"
      confirmLoading={submitting}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Creates an insurer with a minimal valid configuration. Tune branding, claim types, approval, notifications,
        SLA, and custom fields afterwards in the editor.
      </p>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item label="Company name" name="name" rules={[{ required: true, message: 'Enter a company name' }]}>
          <Input placeholder="Aurora Health" autoFocus />
        </Form.Item>
        <Form.Item
          label="Slug"
          name="slug"
          rules={[
            { required: true, message: 'Enter a slug' },
            { pattern: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers, and hyphens only' },
          ]}
        >
          <Input placeholder="aurora-health" prefix={<span className="muted">/</span>} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
