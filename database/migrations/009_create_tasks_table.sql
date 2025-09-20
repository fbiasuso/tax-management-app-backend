-- database/migrations/009_create_tasks_table.sql

-- Crear enum para estados de tareas
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'pending', 'in_progress', 'paused', 
        'completed', 'cancelled', 'overdue'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear enum para prioridad de tareas
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear enum para tipos de tareas
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('automatic', 'manual', 'recurring');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla principal de tareas
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    module_id UUID REFERENCES tax_modules(id) ON DELETE SET NULL, -- NULL para tareas manuales
    client_module_id UUID REFERENCES client_modules(id) ON DELETE CASCADE,
    
    -- Información básica de la tarea
    title VARCHAR(300) NOT NULL,
    description TEXT,
    
    -- Tipo y estado
    task_type task_type NOT NULL DEFAULT 'automatic',
    status task_status NOT NULL DEFAULT 'pending',
    priority task_priority NOT NULL DEFAULT 'normal',
    
    -- Fechas importantes
    due_date DATE NOT NULL,
    due_time TIME, -- Hora específica de vencimiento
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12), -- Mes del período fiscal
    period_year INTEGER CHECK (period_year >= 2020),
    
    -- Fechas de gestión
    start_date DATE,
    completed_date DATE,
    cancelled_date DATE,
    
    -- Asignación
    assigned_to UUID REFERENCES users(id), -- Usuario asignado
    assigned_by UUID REFERENCES users(id), -- Quien asignó
    assigned_at TIMESTAMP,
    
    -- Configuración de notificaciones
    notification_sent BOOLEAN DEFAULT FALSE,
    critical_notification_sent BOOLEAN DEFAULT FALSE,
    last_notification_date TIMESTAMP,
    
    -- Información de seguimiento
    estimated_hours DECIMAL(4,1),
    actual_hours DECIMAL(4,1),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    
    -- Datos adicionales
    amount DECIMAL(12,2), -- Monto si aplica
    reference_number VARCHAR(100), -- Número de referencia, comprobante, etc.
    
    -- Archivos y documentos
    attachments JSONB DEFAULT '[]', -- Array de archivos adjuntos
    
    -- Configuración personalizada
    custom_fields JSONB DEFAULT '{}',
    
    -- Notas y observaciones
    notes TEXT,
    internal_notes TEXT, -- Notas internas del estudio
    
    -- Metadatos
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_task_title CHECK (LENGTH(title) >= 5),
    CONSTRAINT valid_due_date CHECK (due_date >= '2020-01-01'),
    CONSTRAINT valid_completion_dates CHECK (
        (completed_date IS NULL OR completed_date >= start_date) AND
        (cancelled_date IS NULL OR status = 'cancelled') AND
        (completed_date IS NULL OR status = 'completed')
    ),
    CONSTRAINT valid_hours CHECK (
        (estimated_hours IS NULL OR estimated_hours > 0) AND
        (actual_hours IS NULL OR actual_hours >= 0)
    ),
    CONSTRAINT valid_period CHECK (
        (period_month IS NULL AND period_year IS NULL) OR
        (period_month IS NOT NULL AND period_year IS NOT NULL)
    )
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_module_id ON tasks(module_id);
CREATE INDEX idx_tasks_client_module_id ON tasks(client_module_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);

-- Índices compuestos para consultas comunes
CREATE INDEX idx_tasks_status_due_date ON tasks(status, due_date);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_client_status ON tasks(client_id, status);
CREATE INDEX idx_tasks_period ON tasks(period_year, period_month) WHERE period_year IS NOT NULL;

-- Índices para notificaciones
CREATE INDEX idx_tasks_notifications ON tasks(due_date, notification_sent) 
    WHERE status IN ('pending', 'in_progress') AND notification_sent = FALSE;
CREATE INDEX idx_tasks_critical_notifications ON tasks(due_date, critical_notification_sent) 
    WHERE status IN ('pending', 'in_progress') AND critical_notification_sent = FALSE;

-- Índices JSON
CREATE INDEX idx_tasks_attachments ON tasks USING gin(attachments);
CREATE INDEX idx_tasks_custom_fields ON tasks USING gin(custom_fields);

-- Índice de búsqueda por texto
CREATE INDEX idx_tasks_search ON tasks USING gin(
    to_tsvector('spanish', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' ||
        COALESCE(reference_number, '') || ' ' ||
        COALESCE(notes, '')
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar automáticamente fechas según el estado
CREATE OR REPLACE FUNCTION update_task_status_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Si cambió a 'in_progress' y no tenía start_date
    IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.start_date IS NULL THEN
        NEW.start_date = CURRENT_DATE;
    END IF;
    
    -- Si cambió a 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_date = CURRENT_DATE;
        NEW.completion_percentage = 100;
    END IF;
    
    -- Si cambió a 'cancelled'
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        NEW.cancelled_date = CURRENT_DATE;
    END IF;
    
    -- Si cambió de completed/cancelled a otro estado, limpiar fechas
    IF OLD.status IN ('completed', 'cancelled') AND NEW.status NOT IN ('completed', 'cancelled') THEN
        NEW.completed_date = NULL;
        NEW.cancelled_date = NULL;
    END IF;
    
    -- Actualizar estado 'overdue' automáticamente
    IF NEW.status IN ('pending', 'in_progress') AND NEW.due_date < CURRENT_DATE THEN
        NEW.status = 'overdue';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para gestión automática de fechas
CREATE TRIGGER update_task_status_dates_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_status_dates();