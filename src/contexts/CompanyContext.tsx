import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  nome: string;
  ativo: boolean;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedCompany: Company | null;
  loading: boolean;
  isSuperAdmin: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      const list = data || [];
      setCompanies(list);

      // Auto-select first company if none selected
      if (!selectedCompanyId && list.length > 0) {
        const stored = localStorage.getItem('selectedCompanyId');
        if (stored && list.find(c => c.id === stored)) {
          setSelectedCompanyId(stored);
        } else {
          setSelectedCompanyId(list[0].id);
        }
      }

      // Check if super_admin
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user?.id) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.session.user.id)
          .eq('role', 'super_admin');
        setIsSuperAdmin((roles && roles.length > 0) || false);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      localStorage.setItem('selectedCompanyId', selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;

  return (
    <CompanyContext.Provider value={{
      companies,
      selectedCompanyId,
      setSelectedCompanyId,
      selectedCompany,
      loading,
      isSuperAdmin,
      refreshCompanies: loadCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
