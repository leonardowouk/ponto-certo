import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, 
  SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { 
  Clock, Users, CalendarDays, Wallet, LayoutDashboard,
  Settings, LogOut, Loader2, Building2, Building
} from 'lucide-react';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';

interface AdminLayoutProps {
  children: ReactNode;
  currentPage: string;
}

function AdminLayoutInner({ children, currentPage }: AdminLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { companies, selectedCompanyId, setSelectedCompanyId, isSuperAdmin } = useCompany();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
    { id: 'employees', label: 'Colaboradores', icon: Users, href: '/admin/employees' },
    { id: 'sectors', label: 'Setores', icon: Building2, href: '/admin/sectors' },
    { id: 'timesheet', label: 'Espelho de Ponto', icon: CalendarDays, href: '/admin/timesheet' },
    { id: 'hourbank', label: 'Banco de Horas', icon: Wallet, href: '/admin/hourbank' },
    { id: 'settings', label: 'Configurações', icon: Settings, href: '/admin/settings' },
    ...(isSuperAdmin ? [{ id: 'companies', label: 'Empresas', icon: Building, href: '/admin/companies' }] : []),
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
                <Clock className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sidebar-foreground">Ponto RH</h2>
                <p className="text-xs text-sidebar-foreground/60">Painel Admin</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => navigate(item.href)}
                    className="w-full"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-accent-foreground">
                  {user.email?.[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" size="sm" onClick={handleLogout}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </Sidebar>

        <SidebarInset className="flex-1">
          <header className="h-16 border-b flex items-center gap-4 px-6 bg-background">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">
              {menuItems.find(m => m.id === currentPage)?.label || 'Admin'}
            </h1>
            {companies.length > 1 && (
              <div className="ml-auto">
                <Select value={selectedCompanyId || ''} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-56">
                    <Building className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </header>
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function AdminLayout(props: AdminLayoutProps) {
  return <AdminLayoutInner {...props} />;
}
