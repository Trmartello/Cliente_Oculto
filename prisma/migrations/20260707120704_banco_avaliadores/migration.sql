-- AlterTable
ALTER TABLE `Visita` ADD COLUMN `avaliadorId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Avaliador` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_avaliadorId_fkey` FOREIGN KEY (`avaliadorId`) REFERENCES `Avaliador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
