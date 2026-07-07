-- CreateTable
CREATE TABLE `PlanoAcao` (
    `id` VARCHAR(191) NOT NULL,
    `postoId` VARCHAR(191) NOT NULL,
    `blocoNome` VARCHAR(191) NULL,
    `problema` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `status` ENUM('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO') NOT NULL DEFAULT 'ABERTO',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `PlanoAcao_postoId_blocoNome_idx`(`postoId`, `blocoNome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IniciativaPlano` (
    `id` VARCHAR(191) NOT NULL,
    `planoId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `perguntaId` VARCHAR(191) NULL,
    `visitaId` VARCHAR(191) NULL,
    `status` ENUM('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA') NOT NULL DEFAULT 'ABERTA',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `IniciativaPlano_planoId_idx`(`planoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcaoPlano` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `status` ENUM('NO_PRAZO', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA', 'CANCELADA', 'PAUSADA', 'AGUARDANDO_VALIDACAO') NOT NULL DEFAULT 'NO_PRAZO',
    `dataLimite` DATETIME(3) NULL,
    `responsavelNome` VARCHAR(191) NULL,
    `responsavelId` VARCHAR(191) NULL,
    `progresso` INTEGER NOT NULL DEFAULT 0,
    `concluidaEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `AcaoPlano_iniciativaId_idx`(`iniciativaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlanoAcao` ADD CONSTRAINT `PlanoAcao_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaPlano` ADD CONSTRAINT `IniciativaPlano_planoId_fkey` FOREIGN KEY (`planoId`) REFERENCES `PlanoAcao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcaoPlano` ADD CONSTRAINT `AcaoPlano_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `IniciativaPlano`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcaoPlano` ADD CONSTRAINT `AcaoPlano_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
