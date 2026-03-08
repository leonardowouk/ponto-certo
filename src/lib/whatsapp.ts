import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a notification type is enabled for a company, then send it.
 * Returns true if sent, false if disabled or error.
 */
export async function sendWhatsAppNotification({
  companyId,
  action,
  employeeId,
  variables = {},
}: {
  companyId: string;
  action: string;
  employeeId?: string;
  variables?: Record<string, string>;
}): Promise<boolean> {
  try {
    // Check if notification is enabled
    const notificationType = actionToNotificationType(action);
    if (notificationType) {
      const { data: setting } = await supabase
        .from('notification_settings')
        .select('is_enabled, message_template')
        .eq('company_id', companyId)
        .eq('notification_type', notificationType)
        .maybeSingle();

      // If setting exists and is disabled, skip
      if (setting && !setting.is_enabled) return false;

      // Pass custom template if available
      if (setting?.message_template) {
        variables._template = setting.message_template;
      }
    }

    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        company_id: companyId,
        action,
        employee_id: employeeId,
        ...variables,
      },
    });

    if (error) {
      console.error('WhatsApp notification error:', error);
      return false;
    }

    return data?.success || false;
  } catch (err) {
    console.error('WhatsApp notification error:', err);
    return false;
  }
}

function actionToNotificationType(action: string): string | null {
  const map: Record<string, string> = {
    notify_document: 'new_document',
    notify_correction_approved: 'correction_approved',
    notify_correction_rejected: 'correction_rejected',
    notify_closing: 'monthly_closing',
    notify_certificate: 'certificate_received',
  };
  return map[action] || null;
}
