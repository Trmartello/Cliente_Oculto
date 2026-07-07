-- CreateTable
CREATE TABLE `PesquisaNps` (
    `id` VARCHAR(191) NOT NULL,
    `postoId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PesquisaNps_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RespostaNps` (
    `id` VARCHAR(191) NOT NULL,
    `pesquisaId` VARCHAR(191) NOT NULL,
    `nota` INTEGER NOT NULL,
    `comentario` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RespostaNps_pesquisaId_criadoEm_idx`(`pesquisaId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PesquisaNps` ADD CONSTRAINT `PesquisaNps_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RespostaNps` ADD CONSTRAINT `RespostaNps_pesquisaId_fkey` FOREIGN KEY (`pesquisaId`) REFERENCES `PesquisaNps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
