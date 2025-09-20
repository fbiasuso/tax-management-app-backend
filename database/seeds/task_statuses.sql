-- database/seeds/task_statuses.sql
-- Estados de tareas - versión simplificada

-- Este seed crea tablas de configuración para los estados de tareas
-- Los estados base ya están definidos como ENUM en la migración 009

-- Tabla de configuración para estados de tareas
CREATE TABLE IF NOT EXISTS task_status_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_code VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_hex VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50),
    is_final_state BOOLEAN DEFAULT FALSE,
    can_transition_to TEXT DEFAULT '',
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración de estados
INSERT INTO task_status_config (
    status_code, display_name, description, color_hex, icon, 
    is_final_state, can_transition_to, display_order
) VALUES
('pending', 'Pendiente', 'Tarea creada pero no iniciada', '#F59E0B', 'clock', false, 
 'in_progress,cancelled', 1),
('in_progress', 'En Progreso', 'Tarea siendo trabajada actualmente', '#3B82F6', 'play', false,
 'paused,completed,cancelled', 2),
('paused', 'Pausada', 'Tarea temporalmente suspendida', '#8B5CF6', 'pause', false,
 'in_progress,cancelled,completed', 3),
('completed', 'Completada', 'Tarea finalizada exitosamente', '#10B981', 'check-circle', true,
 '', 4),
('cancelled', 'Cancelada', 'Tarea cancelada sin completar', '#EF4444', 'x-circle', true,
 '', 5),
('overdue', 'Vencida', 'Tarea no completada en fecha límite', '#DC2626', 'alert-triangle', false,
 'in_progress,completed,cancelled', 6)
ON CONFLICT (status_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color_hex = EXCLUDED.color_hex,
    icon = EXCLUDED.icon,
    is_final_state = EXCLUDED.is_final_state,
    can_transition_to = EXCLUDED.can_transition_to,
    display_order = EXCLUDED.display_order;

-- Tabla de configuración para prioridades de tareas
CREATE TABLE IF NOT EXISTS task_priority_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_code VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_hex VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50),
    numeric_value INTEGER,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración de prioridades
INSERT INTO task_priority_config (
    priority_code, display_name, description, color_hex, icon, 
    numeric_value, display_order
) VALUES
('low', 'Baja', 'Prioridad baja - Sin urgencia', '#6B7280', 'arrow-down', 1, 1),
('normal', 'Normal', 'Prioridad normal - Rutinaria', '#3B82F6', 'minus', 2, 2),
('high', 'Alta', 'Prioridad alta - Importante', '#F59E0B', 'arrow-up', 3, 3),
('urgent', 'Urgente', 'Prioridad urgente - Crítica', '#DC2626', 'alert-triangle', 4, 4)
ON CONFLICT (priority_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color_hex = EXCLUDED.color_hex,
    icon = EXCLUDED.icon,
    numeric_value = EXCLUDED.numeric_value,
    display_order = EXCLUDED.display_order;