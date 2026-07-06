-- CreateTable
CREATE TABLE `Posto` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `bandeira` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(2) NOT NULL,
    `regiao` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Posto_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `papel` ENUM('ADMIN', 'CONTROLADORIA', 'GESTOR_REGIONAL', 'GERENTE', 'CONSULTA') NOT NULL,
    `postoId` VARCHAR(191) NULL,
    `regiao` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Questionario` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('RASCUNHO', 'ATIVO', 'ARQUIVADO') NOT NULL DEFAULT 'RASCUNHO',
    `penalidadeCriticaTipo` ENUM('NENHUMA', 'PERCENTUAL', 'TETO') NOT NULL DEFAULT 'TETO',
    `penalidadeCriticaValor` DECIMAL(5, 2) NOT NULL DEFAULT 74,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bloco` (
    `id` VARCHAR(191) NOT NULL,
    `questionarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `peso` DECIMAL(5, 2) NOT NULL,
    `ordem` INTEGER NOT NULL,

    INDEX `Bloco_questionarioId_ordem_idx`(`questionarioId`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pergunta` (
    `id` VARCHAR(191) NOT NULL,
    `blocoId` VARCHAR(191) NOT NULL,
    `texto` TEXT NOT NULL,
    `tipo` ENUM('SIM_NAO', 'NOTA_1_5', 'NOTA_1_10', 'ATENDE_NAO_ATENDE', 'TEXTO', 'FOTO') NOT NULL,
    `peso` DECIMAL(5, 2) NOT NULL,
    `criticidade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'MEDIA',
    `obrigatoria` BOOLEAN NOT NULL DEFAULT true,
    `permiteNaoSeAplica` BOOLEAN NOT NULL DEFAULT false,
    `notaMaxima` DECIMAL(5, 2) NOT NULL,
    `ordem` INTEGER NOT NULL,

    INDEX `Pergunta_blocoId_ordem_idx`(`blocoId`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meta` (
    `id` VARCHAR(191) NOT NULL,
    `postoId` VARCHAR(191) NULL,
    `blocoNome` VARCHAR(191) NULL,
    `scoreMinimo` DECIMAL(5, 2) NOT NULL,
    `vigenciaInicio` DATETIME(3) NULL,
    `vigenciaFim` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visita` (
    `id` VARCHAR(191) NOT NULL,
    `postoId` VARCHAR(191) NOT NULL,
    `questionarioId` VARCHAR(191) NOT NULL,
    `criadaPorId` VARCHAR(191) NOT NULL,
    `avaliadorNome` VARCHAR(191) NULL,
    `dataAgendada` DATETIME(3) NOT NULL,
    `status` ENUM('AGENDADA', 'EM_ANDAMENTO', 'ENVIADA', 'EXPIRADA', 'CANCELADA') NOT NULL DEFAULT 'AGENDADA',
    `dataInicio` DATETIME(3) NULL,
    `dataEnvio` DATETIME(3) NULL,
    `scoreFinal` DECIMAL(5, 2) NULL,
    `scoreBruto` DECIMAL(5, 2) NULL,
    `faixaIgeo` ENUM('EXCELENCIA', 'MUITO_BOM', 'BOM', 'REGULAR', 'CRITICO') NULL,
    `temFalhaCritica` BOOLEAN NOT NULL DEFAULT false,
    `scoresPorBloco` JSON NULL,
    `matrizJson` JSON NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Visita_postoId_dataEnvio_idx`(`postoId`, `dataEnvio`),
    INDEX `Visita_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TokenAcesso` (
    `id` VARCHAR(191) NOT NULL,
    `visitaId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `status` ENUM('ATIVO', 'USADO', 'EXPIRADO', 'REVOGADO') NOT NULL DEFAULT 'ATIVO',
    `primeiroAcessoEm` DATETIME(3) NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TokenAcesso_visitaId_key`(`visitaId`),
    UNIQUE INDEX `TokenAcesso_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resposta` (
    `id` VARCHAR(191) NOT NULL,
    `visitaId` VARCHAR(191) NOT NULL,
    `perguntaId` VARCHAR(191) NOT NULL,
    `valor` TEXT NULL,
    `naoSeAplica` BOOLEAN NOT NULL DEFAULT false,
    `comentario` TEXT NULL,
    `notaObtida` DECIMAL(5, 2) NULL,
    `notaMaximaSnapshot` DECIMAL(5, 2) NULL,
    `pesoPerguntaSnapshot` DECIMAL(5, 2) NULL,
    `pesoBlocoSnapshot` DECIMAL(5, 2) NULL,
    `criticidadeSnapshot` ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA') NULL,
    `scoreItem` DECIMAL(7, 4) NULL,
    `reprovada` BOOLEAN NOT NULL DEFAULT false,
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Resposta_visitaId_perguntaId_key`(`visitaId`, `perguntaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidencia` (
    `id` VARCHAR(191) NOT NULL,
    `respostaId` VARCHAR(191) NULL,
    `acaoId` VARCHAR(191) NULL,
    `tipo` ENUM('FOTO') NOT NULL DEFAULT 'FOTO',
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `tamanhoBytes` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NaoConformidade` (
    `id` VARCHAR(191) NOT NULL,
    `visitaId` VARCHAR(191) NOT NULL,
    `perguntaId` VARCHAR(191) NULL,
    `origem` ENUM('FALHA_CRITICA', 'SCORE_ABAIXO_META', 'MANUAL') NOT NULL,
    `descricao` TEXT NOT NULL,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL,
    `status` ENUM('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `responsavelId` VARCHAR(191) NULL,
    `prazo` DATETIME(3) NULL,
    `dataConclusao` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NaoConformidade_status_prioridade_idx`(`status`, `prioridade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Acao` (
    `id` VARCHAR(191) NOT NULL,
    `naoConformidadeId` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `responsavelId` VARCHAR(191) NULL,
    `prazo` DATETIME(3) NULL,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `status` ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'PENDENTE',
    `dataConclusao` DATETIME(3) NULL,
    `comentarios` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloco` ADD CONSTRAINT `Bloco_questionarioId_fkey` FOREIGN KEY (`questionarioId`) REFERENCES `Questionario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pergunta` ADD CONSTRAINT `Pergunta_blocoId_fkey` FOREIGN KEY (`blocoId`) REFERENCES `Bloco`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meta` ADD CONSTRAINT `Meta_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_postoId_fkey` FOREIGN KEY (`postoId`) REFERENCES `Posto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_questionarioId_fkey` FOREIGN KEY (`questionarioId`) REFERENCES `Questionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visita` ADD CONSTRAINT `Visita_criadaPorId_fkey` FOREIGN KEY (`criadaPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TokenAcesso` ADD CONSTRAINT `TokenAcesso_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `Visita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resposta` ADD CONSTRAINT `Resposta_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `Visita`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resposta` ADD CONSTRAINT `Resposta_perguntaId_fkey` FOREIGN KEY (`perguntaId`) REFERENCES `Pergunta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_respostaId_fkey` FOREIGN KEY (`respostaId`) REFERENCES `Resposta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_acaoId_fkey` FOREIGN KEY (`acaoId`) REFERENCES `Acao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NaoConformidade` ADD CONSTRAINT `NaoConformidade_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `Visita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NaoConformidade` ADD CONSTRAINT `NaoConformidade_perguntaId_fkey` FOREIGN KEY (`perguntaId`) REFERENCES `Pergunta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NaoConformidade` ADD CONSTRAINT `NaoConformidade_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Acao` ADD CONSTRAINT `Acao_naoConformidadeId_fkey` FOREIGN KEY (`naoConformidadeId`) REFERENCES `NaoConformidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Acao` ADD CONSTRAINT `Acao_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
