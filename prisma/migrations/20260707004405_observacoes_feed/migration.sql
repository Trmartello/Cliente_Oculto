-- AlterTable
ALTER TABLE `Evidencia` ADD COLUMN `observacaoId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Observacao` (
    `id` VARCHAR(191) NOT NULL,
    `respostaId` VARCHAR(191) NOT NULL,
    `texto` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Observacao_respostaId_criadoEm_idx`(`respostaId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Observacao` ADD CONSTRAINT `Observacao_respostaId_fkey` FOREIGN KEY (`respostaId`) REFERENCES `Resposta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_observacaoId_fkey` FOREIGN KEY (`observacaoId`) REFERENCES `Observacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
