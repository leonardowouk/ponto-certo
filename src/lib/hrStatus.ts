export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  danger: 'bg-destructive/15 text-destructive border-destructive/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function toneClass(tone: StatusTone) {
  return TONE_CLASSES[tone];
}

const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  pre_admissao: { label: 'Pré-admissão', tone: 'neutral' },
  em_admissao: { label: 'Em admissão', tone: 'info' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'warning' },
  admissao_concluida: { label: 'Admissão concluída', tone: 'success' },
  ativo: { label: 'Ativo', tone: 'success' },
  inativo: { label: 'Inativo', tone: 'neutral' },
  desligado: { label: 'Desligado', tone: 'danger' },
  // documentos / assinaturas
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  enviado: { label: 'Enviado', tone: 'info' },
  visualizado: { label: 'Visualizado', tone: 'info' },
  pendente: { label: 'Pendente', tone: 'warning' },
  assinado: { label: 'Assinado', tone: 'success' },
  recusado: { label: 'Recusado', tone: 'danger' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
  expirado: { label: 'Expirado', tone: 'danger' },
  erro: { label: 'Erro', tone: 'danger' },
  arquivado: { label: 'Arquivado', tone: 'neutral' },
};

export function statusInfo(status?: string | null) {
  if (!status) return { label: '—', tone: 'neutral' as StatusTone };
  return STATUS_MAP[status] || { label: status, tone: 'neutral' as StatusTone };
}

export const ADMISSION_STATUS_OPTIONS = [
  'pre_admissao',
  'em_admissao',
  'aguardando_assinatura',
  'admissao_concluida',
  'ativo',
  'inativo',
  'desligado',
];

export const CONTRACT_TYPES = ['CLT', 'Estágio', 'Aprendiz', 'Temporário', 'PJ', 'Autônomo'];
