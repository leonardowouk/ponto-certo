Encontrei a causa provável: uma migração recente revogou `EXECUTE` das funções centrais de permissão (`get_user_company_ids`, `is_admin_or_rh`, `has_role`, `is_super_admin`) para usuários autenticados. Essas funções são usadas diretamente pelas políticas de acesso de empresas, usuários e várias telas administrativas. Resultado: as consultas do painel passam a falhar por permissão e parecem “sumir” empresas/acessos.

Plano de correção:

1. Restaurar permissões das funções de autorização
   - Criar uma nova migração para conceder novamente `EXECUTE` aos usuários autenticados nas funções usadas pelas políticas RLS:
     - `public.get_user_company_ids(uuid)`
     - `public.is_admin_or_rh(uuid)`
     - `public.has_role(uuid, public.app_role)`
     - `public.is_super_admin(uuid)`
   - Manter as funções como `SECURITY DEFINER`, com `search_path` controlado, para evitar recursão e manter segurança.
   - Não liberar essas funções para `anon`, apenas `authenticated` e os papéis internos necessários.

2. Corrigir a migração problemática no repositório
   - Ajustar a migração `20260427175521...` no código para não deixar o projeto em estado quebrado caso seja reaplicado em outro ambiente.
   - Substituir a revogação ampla por permissões explícitas seguras.

3. Validar empresas e acessos administrativos
   - Conferir se as empresas continuam no banco. Já confirmei que existem 2 empresas.
   - Conferir se `user_roles` e `user_company_access` continuam no banco. Já confirmei que existem dados.
   - Validar que seu usuário ainda tem `super_admin`/`admin` e vínculo com empresa.

4. Revisar telas afetadas
   - Confirmar que `CompanyContext` volta a carregar empresas.
   - Confirmar que a área de Usuários volta a exibir papéis e vínculos por empresa.
   - Verificar se não há erro de permissão nas telas administrativas que dependem de `get_user_company_ids()`.

5. Rodar verificação de segurança novamente
   - Executar linter/scan após a correção.
   - Garantir que a correção não reabre acesso público indevido.

Detalhe técnico:

A migração problemática contém:

```sql
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_company_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_rh(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
```

Isso quebra políticas como:

```sql
USING (id IN (SELECT get_user_company_ids(auth.uid())))
```

Correção prevista:

```sql
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_rh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
```

Também vou manter `set_extra_record_total_minutes()` sem exposição desnecessária ao cliente, porque é função de trigger e não precisa ser chamada pelo painel.