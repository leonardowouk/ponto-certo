import { supabase } from '@/integrations/supabase/client';

export interface AuditEntry {
  companyId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  employeeId?: string | null;
  documentId?: string | null;
  result?: 'sucesso' | 'erro';
  details?: Record<string, unknown>;
}

/**
 * Registra uma ação no log de auditoria. Nunca quebra o fluxo principal.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let actorRole: string | null = null;
    if (user) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      actorRole = roles?.map(r => r.role).join(', ') || null;
    }

    await supabase.from('audit_logs').insert({
      company_id: entry.companyId ?? null,
      actor_user_id: user?.id ?? null,
      actor_role: actorRole,
      actor_name: user?.email ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      employee_id: entry.employeeId ?? null,
      document_id: entry.documentId ?? null,
      result: entry.result ?? 'sucesso',
      details: (entry.details ?? {}) as never,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
