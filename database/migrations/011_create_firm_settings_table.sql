-- database/migrations/011_create_firm_settings_table.sql

-- Crear enum para tipos de configuraciones
DO $$ BEGIN
    CREATE TYPE setting_type AS ENUM (
        'string', 'number', 'boolean', 'json', 
        'date', 'time', 'email', 'url'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de configuraciones por estudio contable
CREATE TABLE firm_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id) ON DELETE CASCADE,
    
    -- Clave de configuración
    setting_key VARCHAR(100) NOT NULL,
    setting_category VARCHAR(50) DEFAULT 'general', -- 'general', 'notifications', 'billing', etc.
    
    -- Valor y tipo
    setting_value TEXT, -- Valor como string
    setting_type setting_type NOT NULL DEFAULT 'string',
    
    -- Configuración JSON para tipos complejos
    json_value JSONB, -- Para configuraciones complejas
    
    -- Metadata de la configuración
    display_name VARCHAR(200), -- Nombre amigable para UI
    description TEXT,
    
    -- Configuración de validación
    is_required BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    validation_rules JSONB DEFAULT '{}', -- Reglas de validación
    
    -- Control de acceso
    is_public BOOLEAN DEFAULT FALSE, -- Si otros miembros pueden ver
    editable_by_roles firm_role[] DEFAULT '{owner}',
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadatos
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_setting_key CHECK (LENGTH(setting_key) >= 2 AND setting_key ~ '^[a-zA-Z][a-zA-Z0-9_]*$'),
    CONSTRAINT valid_setting_category CHECK (LENGTH(setting_category) >= 2),
    CONSTRAINT valid_json_for_type CHECK (
        setting_type != 'json' OR json_value IS NOT NULL
    ),
    UNIQUE(firm_id, setting_key) -- Clave única por estudio
);

-- Índices
CREATE INDEX idx_firm_settings_firm_id ON firm_settings(firm_id);
CREATE INDEX idx_firm_settings_key ON firm_settings(setting_key);
CREATE INDEX idx_firm_settings_category ON firm_settings(setting_category);
CREATE INDEX idx_firm_settings_type ON firm_settings(setting_type);
CREATE INDEX idx_firm_settings_public ON firm_settings(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_firm_settings_active ON firm_settings(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_firm_settings_json ON firm_settings USING gin(json_value) WHERE json_value IS NOT NULL;
CREATE INDEX idx_firm_settings_roles ON firm_settings USING gin(editable_by_roles);

-- Trigger para updated_at
CREATE TRIGGER update_firm_settings_updated_at 
    BEFORE UPDATE ON firm_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para obtener configuración con valor por defecto
CREATE OR REPLACE FUNCTION get_firm_setting(
    p_firm_id UUID,
    p_setting_key VARCHAR,
    p_default_value TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT COALESCE(setting_value, default_value, p_default_value)
    INTO result
    FROM firm_settings 
    WHERE firm_id = p_firm_id 
    AND setting_key = p_setting_key 
    AND is_active = TRUE;
    
    RETURN COALESCE(result, p_default_value);
END;
$$ language 'plpgsql';

-- Insertar configuraciones por defecto para nuevos estudios
CREATE OR REPLACE FUNCTION create_default_firm_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Configuraciones generales
    INSERT INTO firm_settings (firm_id, setting_key, setting_category, setting_value, setting_type, display_name, description, is_required, default_value) VALUES
    
    -- Configuraciones de notificaciones
    (NEW.id, 'notification_email', 'notifications', NEW.email, 'email', 'Email de Notificaciones', 'Email principal para notificaciones del sistema', true, NEW.email),
    (NEW.id, 'notification_days_before', 'notifications', '5', 'number', 'Días de Anticipación', 'Días antes del vencimiento para enviar notificaciones', true, '5'),
    (NEW.id, 'critical_notification_days', 'notifications', '1', 'number', 'Notificación Crítica', 'Días antes para notificación crítica', true, '1'),
    (NEW.id, 'weekend_notifications', 'notifications', 'false', 'boolean', 'Notificaciones Fines de Semana', 'Enviar notificaciones en fines de semana', false, 'false'),
    
    -- Configuraciones de facturación
    (NEW.id, 'default_currency', 'billing', 'ARS', 'string', 'Moneda por Defecto', 'Moneda principal del estudio', true, 'ARS'),
    (NEW.id, 'tax_rate', 'billing', '21.0', 'number', 'Alícuota IVA', 'Alícuota de IVA por defecto', true, '21.0'),
    
    -- Configuraciones de sistema
    (NEW.id, 'timezone', 'system', COALESCE(NEW.timezone, 'America/Argentina/Buenos_Aires'), 'string', 'Zona Horaria', 'Zona horaria del estudio', true, 'America/Argentina/Buenos_Aires'),
    (NEW.id, 'date_format', 'system', 'DD/MM/YYYY', 'string', 'Formato de Fecha', 'Formato de visualización de fechas', true, 'DD/MM/YYYY'),
    (NEW.id, 'auto_generate_tasks', 'system', 'true', 'boolean', 'Generar Tareas Automáticamente', 'Generar tareas de vencimientos automáticamente', true, 'true'),
    
    -- Configuraciones de seguridad
    (NEW.id, 'session_timeout', 'security', '24', 'number', 'Tiempo de Sesión (horas)', 'Tiempo antes de cerrar sesión automáticamente', true, '24'),
    (NEW.id, 'require_2fa', 'security', 'false', 'boolean', 'Requerir 2FA', 'Requerir autenticación de dos factores', false, 'false'),
    
    -- Configuraciones de backup
    (NEW.id, 'backup_frequency', 'backup', 'daily', 'string', 'Frecuencia de Backup', 'Frecuencia de respaldos automáticos', true, 'daily'),
    (NEW.id, 'backup_retention_days', 'backup', '30', 'number', 'Retención de Backups', 'Días para mantener backups', true, '30');
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para crear configuraciones por defecto
CREATE TRIGGER create_default_settings_for_new_firm
    AFTER INSERT ON accounting_firms
    FOR EACH ROW EXECUTE FUNCTION create_default_firm_settings();