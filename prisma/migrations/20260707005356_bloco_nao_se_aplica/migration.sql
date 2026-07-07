-- CreateTable
CREATE TABLE `BlocoResposta` (
    `id` VARCHAR(191) NOT NULL,
    `visitaId` VARCHAR(191) NOT NULL,
    `blocoId` VARCHAR(191) NOT NULL,
    `naoSeAplica` BOOLEAN NOT NULL DEFAULT true,
    `comentario` TEXT NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlocoResposta_visitaId_blocoId_key`(`visitaId`, `blocoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlocoResposta` ADD CONSTRAINT `BlocoResposta_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `Visita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlocoResposta` ADD CONSTRAINT `BlocoResposta_blocoId_fkey` FOREIGN KEY (`blocoId`) REFERENCES `Bloco`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
