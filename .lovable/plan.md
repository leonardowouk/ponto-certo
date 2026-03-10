

## Problema

O preview do Upload Inteligente baixa o PDF original completo e usa `#page=N` para navegar. O usuário pode rolar e ver holerites de outros colaboradores.

## Solução

Alterar `handlePreviewPage` em `BulkHoleriteUpload.tsx` para usar a action `preview_page` da Edge Function `split-holerites`, que já existe e extrai apenas a página individual no servidor. Assim o frontend recebe somente 1 página, sem possibilidade de ver as demais.

## Alterações

**1. `src/components/admin/BulkHoleriteUpload.tsx`** - Modificar `handlePreviewPage`:
- Em vez de `supabase.storage.from('documentos').download(...)`, chamar `supabase.functions.invoke('split-holerites', { body: { action: 'preview_page', storage_path, page } })`
- O retorno será um blob PDF de página única
- Criar o `blobUrl` a partir desse blob e exibir no iframe sem `#page=N`

Essa é uma mudança cirúrgica de ~15 linhas, apenas na função `handlePreviewPage`. A Edge Function já suporta essa action e já usa o método `removePage` que funciona com PDFs criptografados.

