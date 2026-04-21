ALTER TABLE public.checklist_respostas
  ADD CONSTRAINT checklist_respostas_exec_item_unique UNIQUE (execucao_id, item_id);

ALTER TABLE public.checklist_whatsapp_sessions
  ADD CONSTRAINT checklist_wpp_sessions_phone_company_unique UNIQUE (phone, company_id);