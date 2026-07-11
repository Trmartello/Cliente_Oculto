-- AlterTable
ALTER TABLE `NaoConformidade` ADD COLUMN `contestacao` TEXT NULL,
    ADD COLUMN `contestadaEm` DATETIME(3) NULL,
    ADD COLUMN `contestadaPorId` VARCHAR(191) NULL,
    ADD COLUMN `decisaoContestacao` TEXT NULL,
    ADD COLUMN `reincidencia` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `validadaEm` DATETIME(3) NULL,
    ADD COLUMN `validadaPorId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('ABERTA', 'EM_CONTESTACAO', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO', 'RESOLVIDA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA';

-- CreateIndex
CREATE INDEX `NaoConformidade_reincidencia_idx` ON `NaoConformidade`(`reincidencia`);

-- AddForeignKey
ALTER TABLE `NaoConformidade` ADD CONSTRAINT `NaoConformidade_contestadaPorId_fkey` FOREIGN KEY (`contestadaPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NaoConformidade` ADD CONSTRAINT `NaoConformidade_validadaPorId_fkey` FOREIGN KEY (`validadaPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
