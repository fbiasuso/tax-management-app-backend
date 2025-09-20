-- database/migrations/007_create_tax_modules_table.sql

-- Limpiar tipos existentes si hay conflictos
DROP TYPE IF EXISTS frequency_type CASCADE;
DROP TYPE IF EXISTS module_type CASCADE;

-- Crear enums necesarios
CREATE TYPE frequency_type AS ENUM (
    'monthly', 'bimonthly', 'quarterly', 
    'semiannual', 'annual', 'sporadic'
);

CREATE TYPE module_type AS ENUM (
    'tax_return', 'information_return', 'payment',
    'registration', 'certificate', 'other'
);

-- Tabla de módulos fiscales disponibles
CREATE TABLE tax_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id) ON DELETE CASCADE,
    
    -- Información básica del módulo
    code VARCHAR(50) NOT NULL, -- F931, F747, etc.
    name VARCHAR(200) NOT NULL,
    description TEXT,
    full_name VARCHAR(300),
    
    -- Tipo de módulo
    module_type module_type NOT NULL DEFAULT 'tax_return',
    
    -- Configuración de vencimientos
    frequency frequency_type NOT NULL DEFAULT 'monthly',
    due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
    due_month INTEGER CHECK (due_month BETWEEN 1 AND 12), -- Para anuales
    
    -- Configuración de cálculo de vencimiento
    business_days_offset INTEGER DEFAULT 0, -- Días hábiles de offset
    weekend_rule VARCHAR(20) DEFAULT 'next_business_day',
    
    -- Configuración específica del módulo
    requires_payment BOOLEAN DEFAULT TRUE,
    has_zero_return BOOLEAN DEFAULT TRUE, -- Permite declaración en cero
    min_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Configuración de notificaciones
    notification_days_before INTEGER DEFAULT 5,
    critical_notification_days INTEGER DEFAULT 1,
    
    -- Configuración de formularios
    form_settings JSONB DEFAULT '{}', -- URLs, instrucciones, etc.
    
    -- Aplicabilidad (simplificado como TEXT por ahora)
    applicable_categories_text TEXT DEFAULT '',
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    implementation_date DATE DEFAULT CURRENT_DATE,
    deprecation_date DATE,
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_module_code CHECK (LENGTH(code) >= 2),
    CONSTRAINT valid_module_name CHECK (LENGTH(name) >= 5),
    CONSTRAINT valid_due_day CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
    CONSTRAINT valid_notification_days CHECK (notification_days_before >= 0 AND critical_notification_days >= 0),
    CONSTRAINT valid_dates CHECK (deprecation_date IS NULL OR deprecation_date > implementation_date),
    UNIQUE(jurisdiction_id, code) -- Código único por jurisdicción
);

-- Índices
CREATE INDEX idx_tax_modules_jurisdiction_id ON tax_modules(jurisdiction_id);
CREATE INDEX idx_tax_modules_code ON tax_modules(code);
CREATE INDEX idx_tax_modules_frequency ON tax_modules(frequency);
CREATE INDEX idx_tax_modules_module_type ON tax_modules(module_type);
CREATE INDEX idx_tax_modules_due_day ON tax_modules(due_day);
CREATE INDEX idx_tax_modules_active ON tax_modules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tax_modules_form_settings ON tax_modules USING gin(form_settings);
CREATE INDEX idx_tax_modules_implementation ON tax_modules(implementation_date);

-- Índice de búsqueda por texto
CREATE INDEX idx_tax_modules_search ON tax_modules USING gin(
    to_tsvector('spanish', 
        COALESCE(name, '') || ' ' || 
        COALESCE(code, '') || ' ' ||
        COALESCE(description, '')
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_tax_modules_updated_at 
    BEFORE UPDATE ON tax_modules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();