-- Página de Carreiras: conteúdo editável (JSON validado na aplicação) e imagens enviadas.
-- CreateTable
CREATE TABLE "paginas_carreiras" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conteudo" JSONB NOT NULL,
    "atualizado_por" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paginas_carreiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "midias_carreiras" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "caminho" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "enviado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "midias_carreiras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paginas_carreiras_tenant_id_key" ON "paginas_carreiras"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "midias_carreiras_caminho_key" ON "midias_carreiras"("caminho");

-- CreateIndex
CREATE INDEX "midias_carreiras_tenant_id_idx" ON "midias_carreiras"("tenant_id");

