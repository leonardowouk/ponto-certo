# Relatório de Horas — Alana Rodrigues Machado (Drop's)

Gerar uma planilha Excel com os horários de entrada/saída da Alana desde 01/03/2026, para apoiar o fechamento de horas dela.

## Dados confirmados
- Colaboradora: ALANA RODRIGUES MACHADO (Supervisora Operacional, Drop's Café & Cia)
- 399 batidas de ponto desde 04/03/2026 até 26/08/2026
- 129 dias consolidados em `timesheets_daily` no período

## Conteúdo da planilha

**Aba 1 — Resumo diário** (a partir de `timesheets_daily`):
- Data (dia da semana)
- Primeira batida / Última batida
- Horas trabalhadas, intervalo, horas esperadas, saldo do dia
- Status do dia (ok, falta, abono, revisão, ajustado)
- Linha de totais: horas trabalhadas, esperadas e saldo acumulado

**Aba 2 — Batidas brutas** (a partir de `time_punches`):
- Data e hora exata de cada batida, tipo (entrada/saída/intervalo início/fim), status e unidade

**Aba 3 — Resumo mensal**: horas trabalhadas, esperadas e saldo consolidado por mês (mar–ago), para o fechamento.

## Execução
1. Extrair dados com consulta ao banco (psql) filtrando pelo `employee_id` da Alana e período >= 2026-03-01.
2. Gerar o arquivo `.xlsx` com openpyxl (formatação: cabeçalho em destaque, horas em formato `h:mm`, totais via fórmulas SUM, zeros como "-", sem erros de fórmula — recalcular com LibreOffice).
3. Salvar em `/mnt/documents/relatorio-ponto-alana-mar-ago-2026.xlsx` e entregar o arquivo no chat.
