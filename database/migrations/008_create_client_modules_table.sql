-- database/migrations/008_create_client_modules_table.sql

-- Tabla de relación entre clientes y módulos fiscales (muchos a muchos)
CREATE TABLE client_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES tax_modules(id) ON DELETE CASCADE,
    
    -- Configuración específica para este cliente-módulo
    custom_due_day INTEGER CHECK (custom_due_day BETWEEN 1 AND 31),
    custom_notification_days INTEGER,
    custom_settings JSONB DEFAULT '{}',
    
    -- Estado de la asignación
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Configuración de generación automática de tareas
    auto_generate_tasks BOOLEAN DEFAULT TRUE,
    last_task_generated_for DATE, -- Última fecha para la cual se generó tarea
    
    -- Notas específicas
    notes TEXT,
    
    -- Metadatos
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT valid_custom_due_day CHECK (custom_due_day IS NULL OR (custom_due_day >= 1 AND custom_due_day <= 31)),
    CONSTRAINT valid_custom_notifications CHECK (custom_notification_days IS NULL OR custom_notification_days >= 0),
    UNIQUE(client_id, module_id) -- Un cliente no puede tener el mismo módulo duplicado
);

-- Índices para optimizar consultas
CREATE INDEX idx_client_modules_client_id ON client_modules(client_id);
CREATE INDEX idx_client_modules_module_id ON client_modules(module_id);
CREATE INDEX idx_client_modules_active ON client_modules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_client_modules_auto_generate ON client_modules(auto_generate_tasks) WHERE auto_generate_tasks = TRUE;
CREATE INDEX idx_client_modules_start_date ON client_modules(start_date);
CREATE INDEX idx_client_modules_end_date ON client_modules(end_date) WHERE end_date IS NOT NULL;
CREATE INDEX idx_client_modules_last_generated ON client_modules(last_task_generated_for);
CREATE INDEX idx_client_modules_assigned_by ON client_modules(assigned_by);
CREATE INDEX idx_client_modules_custom_settings ON client_modules USING gin(custom_settings);

-- Trigger para updated_at
CREATE TRIGGER update_client_modules_updated_at 
    BEFORE UPDATE ON client_modules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();