import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Clock, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getPunchTypeLabel } from '@/lib/hash';

interface PunchDetails {
  id: string;
  punch_type: string;
  punched_at: string;
  status: string;
  selfie_url: string;
  unidade: string;
}

interface PunchDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  workDate: string;
}

export function PunchDetailsModal({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  workDate,
}: PunchDetailsModalProps) {
  const [punches, setPunches] = useState<PunchDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfieUrls, setSelfieUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && employeeId && workDate) {
      loadPunchDetails();
    }
  }, [open, employeeId, workDate]);

  const loadPunchDetails = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date(workDate);
      const endOfDay = new Date(workDate);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data, error } = await supabase
        .from('time_punches')
        .select('id, punch_type, punched_at, status, selfie_url, unidade')
        .eq('employee_id', employeeId)
        .gte('punched_at', startOfDay.toISOString())
        .lt('punched_at', endOfDay.toISOString())
        .order('punched_at', { ascending: true });

      if (error) throw error;

      setPunches(data || []);

      // Generate signed URLs for selfies
      const urls: Record<string, string> = {};
      for (const punch of data || []) {
        if (punch.selfie_url) {
          // selfie_url is stored as "selfies_ponto/employee_id/date/timestamp.jpg"
          // We need to remove the bucket prefix for createSignedUrl
          const filePath = punch.selfie_url.replace(/^selfies_ponto\//, '');
          
          const { data: signedData } = await supabase.storage
            .from('selfies_ponto')
            .createSignedUrl(filePath, 60 * 5); // 5 minutes

          if (signedData?.signedUrl) {
            urls[punch.id] = signedData.signedUrl;
          }
        }
      }
      setSelfieUrls(urls);
    } catch (error) {
      console.error('Error loading punch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ok: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      suspeito: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      ajustado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pendente: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return <Badge className={styles[status] || ''}>{status}</Badge>;
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formattedDate = new Date(workDate).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Detalhes das Batidas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold text-lg">{employeeName}</span>
            </div>
            <p className="text-muted-foreground text-sm capitalize">{formattedDate}</p>
          </div>

          {/* Punches list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : punches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma batida registrada neste dia
            </div>
          ) : (
            <div className="space-y-4">
              {punches.map((punch) => (
                <div
                  key={punch.id}
                  className="border rounded-xl p-4 flex gap-4 items-start"
                >
                  {/* Selfie */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {selfieUrls[punch.id] ? (
                      <img
                        src={selfieUrls[punch.id]}
                        alt="Selfie do ponto"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-lg">
                        {getPunchTypeLabel(punch.punch_type)}
                      </span>
                      {getStatusBadge(punch.status)}
                    </div>

                    <div className="flex items-center gap-2 text-2xl font-mono font-bold text-primary">
                      <Clock className="w-5 h-5" />
                      {formatDateTime(punch.punched_at)}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Unidade: {punch.unidade}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
