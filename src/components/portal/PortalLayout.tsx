import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Clock, FileText, CalendarDays, LogOut, Menu, X, User } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  currentPage: string;
}

interface EmployeeInfo {
  id: string;
  nome: string;
  cargo: string | null;
}

const navItems = [
  { key: 'dashboard', label: 'Meu Painel', icon: CalendarDays, path: '/portal' },
  { key: 'documents', label: 'Meus Documentos', icon: FileText, path: '/portal/documents' },
  { key: 'timesheet', label: 'Meus Pontos', icon: Clock, path: '/portal/timesheet' },
];

export function PortalLayout({ children, currentPage }: Props) {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadEmployee();
  }, []);

  const loadEmployee = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/portal/login'); return; }

    const { data } = await supabase
      .from('employees')
      .select('id, nome, cargo')
      .eq('auth_user_id', user.id)
      .single();

    if (!data) { navigate('/portal/login'); return; }
    setEmployee(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/portal/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{employee?.nome || '...'}</p>
                <p className="text-xs text-muted-foreground truncate">{employee?.cargo || 'Colaborador'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  currentPage === item.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t">
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b flex items-center px-4 gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm">Portal do Colaborador</span>
        </header>
        <div className="p-4 md:p-6 max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
