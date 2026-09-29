-- AddForeignKey
ALTER TABLE "respostas_pulse" ADD CONSTRAINT "respostas_pulse_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas_pulse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_pulse" ADD CONSTRAINT "respostas_pulse_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "perguntas_pulse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
