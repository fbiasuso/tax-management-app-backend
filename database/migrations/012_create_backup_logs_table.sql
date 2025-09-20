-- database/migrations/012_create_backup_logs_table.sql

-- Crear enum para tipos de backup
DO $$ BEGIN
    CREATE TYPE backup_type AS ENUM (
        'full', 'incremental', 'differential', 'manual'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear enum para estado de backup
DO $$ BEGIN
    CREATE TYPE backup_status AS ENUM (
        'pending', 'in_progress', 'completed', 
        'failed', 'cancelled', 'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de logs de respaldos
CREATE TABLE backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES accounting_firms(id) ON DELETE SET NULL, -- NULL para backups globales
    
    -- Información del backup
    backup_type backup_type NOT NULL DEFAULT 'full',
    status backup_status NOT NULL DEFAULT 'pending',
    
    -- Identificación del backup
    backup_name VARCHAR(300) NOT NULL,
    backup_path VARCHAR(500), -- Ruta donde se almacenó
    backup_size BIGINT, -- Tamaño en bytes
    
    -- Información de contenido
    tables_included TEXT[], -- Tablas incluidas en el backup
    total_records INTEGER, -- Total de registros respaldados
    
    -- Fechas del proceso
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP, -- Fecha de expiración del backup
    
    -- Información de duración y performance
    duration_seconds INTEGER, -- Duración en segundos
    compression_ratio DECIMAL(5,2), -- Ratio de compresión
    
    -- Metadatos del proceso
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Usuario que inició (NULL para automático)
    trigger_type VARCHAR(20) DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'automatic')),
    
    -- Información de errores
    error_message TEXT,
    error_details JSONB,
    
    -- Configuración utilizada
    backup_config JSONB DEFAULT '{}', -- Configuración específica usada
    
    -- Información de verificación
    verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    checksum VARCHAR(64), -- Hash del archivo para verificación
    
    -- Metadatos adicionales
    server_version VARCHAR(50),
    client_version VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_backup_name CHECK (LENGTH(backup_name) >= 5),
    CONSTRAINT valid_dates CHECK (
        completed_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT valid_duration CHECK (
        duration_seconds IS NULL OR duration_seconds >= 0
    ),
    CONSTRAINT valid_backup_size CHECK (
        backup_size IS NULL OR backup_size >= 0
    ),
    CONSTRAINT valid_compression CHECK (
        compression_ratio IS NULL OR (compression_ratio >= 0 AND compression_ratio <= 100)
    )
);

-- Índices para consultas frecuentes
CREATE INDEX idx_backup_logs_firm_id ON backup_logs(firm_id);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_backup_type ON backup_logs(backup_type);
CREATE INDEX idx_backup_logs_trigger_type ON backup_logs(trigger_type);
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at);
CREATE INDEX idx_backup_logs_started_at ON backup_logs(started_at) WHERE started_at IS NOT NULL;
CREATE INDEX idx_backup_logs_completed_at ON backup_logs(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_backup_logs_expires_at ON backup_logs(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_backup_logs_verified ON backup_logs(verified, verification_date);
CREATE INDEX idx_backup_logs_triggered_by ON backup_logs(triggered_by) WHERE triggered_by IS NOT NULL;

-- Índices compuestos
CREATE INDEX idx_backup_logs_firm_status_date ON backup_logs(firm_id, status, created_at);
CREATE INDEX idx_backup_logs_type_status ON backup_logs(backup_type, status);

-- Índices JSON
CREATE INDEX idx_backup_logs_config ON backup_logs USING gin(backup_config);
CREATE INDEX idx_backup_logs_error_details ON backup_logs USING gin(error_details) WHERE error_details IS NOT NULL;

-- Vista para estadísticas de backups
CREATE VIEW backup_statistics AS
SELECT 
    firm_id,
    backup_type,
    status,
    COUNT(*) as total_backups,
    AVG(duration_seconds) as avg_duration_seconds,
    AVG(backup_size) as avg_size_bytes,
    MAX(created_at) as last_backup_date,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_backups,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_backups
FROM backup_logs
GROUP BY firm_id, backup_type, status;

-- Función para limpiar backups expirados
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Marcar como expirados
    UPDATE backup_logs 
    SET status = 'expired'
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND status NOT IN ('expired', 'failed');
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log de la limpieza
    INSERT INTO backup_logs (
        backup_name, 
        backup_type, 
        status, 
        trigger_type,
        backup_config,
        created_at
    ) VALUES (
        'CLEANUP_' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS'),
        'manual',
        'completed',
        'automatic',
        jsonb_build_object('expired_backups_cleaned', expired_count),
        CURRENT_TIMESTAMP
    );
    
    RETURN expired_count;
END;
$$ language 'plpgsql';

-- Función para obtener estadísticas de backup por estudio
CREATE OR REPLACE FUNCTION get_firm_backup_stats(p_firm_id UUID)
RETURNS TABLE (
    total_backups INTEGER,
    successful_backups INTEGER,
    failed_backups INTEGER,
    last_backup_date TIMESTAMP,
    avg_backup_size BIGINT,
    oldest_backup_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_backups,
        SUM(CASE WHEN bl.status = 'completed' THEN 1 ELSE 0 END)::INTEGER as successful_backups,
        SUM(CASE WHEN bl.status = 'failed' THEN 1 ELSE 0 END)::INTEGER as failed_backups,
        MAX(bl.created_at) as last_backup_date,
        AVG(bl.backup_size)::BIGINT as avg_backup_size,
        MIN(bl.created_at) as oldest_backup_date
    FROM backup_logs bl
    WHERE bl.firm_id = p_firm_id OR (p_firm_id IS NULL AND bl.firm_id IS NULL);
END;
$$ language 'plpgsql';