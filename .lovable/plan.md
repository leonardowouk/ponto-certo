# Espelho de impressão igual à Conferência

## Problema
- A Conferência recalcula cada dia com a jornada atual (horas esperadas corretas, faltas com saldo negativo, dias sem batida incluídos como falta, abono zerado).
- O Espelho usa os registros salvos brutos: faltas aparecem zeradas e os totais divergem (ex.: -04:21 vs -21:57).
- O cabeçalho do espelho tem 13 colunas mas só 9 são preenchidas, deslocando os valores (Trab. aparece em "Entrada", etc.).

## O que será feito
1. Extrair a lógica de montagem dos dias da Conferência (EmployeeReviewModal) para uma função compartilhada `buildReviewDays(employeeId, refMonth)` em `src/lib/`, retornando dias + totais exatamente como a Conferência calcula.
2. EmployeeReviewModal passa a usar essa função (sem mudar comportamento).
3. O botão "Espelho" em MonthlyClosing usa a mesma função — mesmos dias, mesmas faltas, mesmos totais.
4. Corrigir o cabeçalho do TimesheetPrintView para 9 colunas: Dia, Entrada, Saída Int., Retorno Int., Saída, Trab., Esper., Saldo, Status; rodapé de totais alinhado.

## Resultado
Para Maria de Fatima em julho/2026, o espelho mostrará 180:27 / 202:24 / -21:57, com 21/07 e 31/07 como falta (-08:48).

Nenhum dado do banco é alterado.
