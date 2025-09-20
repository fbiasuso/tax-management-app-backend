-- database/migrations/010_create_audit_logs_simple.sql

-- Crear enum para tipos de acciones auditables
CREATE TYPE audit_action_type AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
    'EXPORT', 'IMPORT', 'VIEW', 'DOWNLOAD', 'UPLOAD',
    'ASSIGN', 'COMPLETE', 'CANCEL', 'APPROVE', 'REJECT'
);

-- Tabla de auditoría para rastrear todas las acciones del sistema
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificación del usuario y contexto
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    firm_id UUID REFERENCES accounting_firms(id) ON DELETE SET NULL,
    
    -- Información de la acción
    action audit_action_type NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- 'client', 'task', 'user', etc.
    resource_id UUID, -- ID del recurso afectado
    
    -- Descripción detallada
    description VARCHAR(500) NOT NULL,
    details JSONB DEFAULT '{}', -- Información adicional estructurada
    
    -- Datos del cambio (para UPDATE)
    old_values JSONB, -- Valores anteriores
    new_values JSONB, -- Valores nuevos
    
    -- Información técnica
    ip_address INET,
    user_agent TEXT,
    request_id UUID, -- Para agrupar acciones relacionadas
    
    -- Metadata de la sesión
    session_id VARCHAR(255),
    
    -- Información adicional del contexto
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- Si la acción involucra un cliente específico
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Si la acción involucra una tarea específica
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_description CHECK (LENGTH(description) >= 10),
    CONSTRAINT valid_resource_type CHECK (LENGTH(resource_type) >= 3)
);

-- Índices para consultas de auditoría
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_firm_id ON audit_logs(firm_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_client_id ON audit_logs(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_audit_logs_task_id ON audit_logs(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_audit_logs_user_action_date ON audit_logs(user_id, action, created_at);
CREATE INDEX idx_audit_logs_firm_resource_date ON audit_logs(firm_id, resource_type, created_at);
CREATE INDEX idx_audit_logs_resource_created ON audit_logs(resource_type, resource_id, created_at);

-- Índices JSON para búsqueda en detalles
CREATE INDEX idx_audit_logs_details ON audit_logs USING gin(details);
CREATE INDEX idx_audit_logs_old_values ON audit_logs USING gin(old_values);
CREATE INDEX idx_audit_logs_new_values ON audit_logs USING gin(new_values);

-- Índice de búsqueda por texto en descripción
CREATE INDEX idx_audit_logs_search ON audit_logs USING gin(
    to_tsvector('spanish', COALESCE(description, ''))
);