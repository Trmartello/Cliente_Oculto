-- AlterTable
ALTER TABLE `Visita` ADD COLUMN `cicloId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Ciclo` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `inicio` DATETIME(3) NULL,
    `fim` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Ciclo_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_cicloId_fkey` FOREIGN KEY (`cicloId`) REFERENCES `Ciclo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
