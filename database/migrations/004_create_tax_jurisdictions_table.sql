-- database/migrations/004_create_tax_jurisdictions_table.sql

-- Crear enum para tipos de jurisdicción
DO $$ BEGIN
    CREATE TYPE jurisdiction_type AS ENUM ('federal', 'provincial', 'municipal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de jurisdicciones fiscales (AFIP, provincias, municipios)
CREATE TABLE tax_jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL, -- 'AFIP', 'ARBA', 'AGIP', etc.
    name VARCHAR(200) NOT NULL,
    full_name VARCHAR(300),
    
    -- Tipo de jurisdicción
    type jurisdiction_type NOT NULL,
    
    -- Jerarquía (para municipios que dependen de provincias)
    parent_jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
    
    -- Configuración específica
    website VARCHAR(300),
    contact_info JSONB DEFAULT '{}', -- emails, teléfonos, etc.
    
    -- Configuración de vencimientos
    default_due_day INTEGER CHECK (default_due_day BETWEEN 1 AND 31),
    timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_jurisdiction_code CHECK (LENGTH(code) >= 2),
    CONSTRAINT valid_jurisdiction_name CHECK (LENGTH(name) >= 3)
);

-- Índices
CREATE INDEX idx_tax_jurisdictions_code ON tax_jurisdictions(code);
CREATE INDEX idx_tax_jurisdictions_type ON tax_jurisdictions(type);
CREATE INDEX idx_tax_jurisdictions_parent ON tax_jurisdictions(parent_jurisdiction_id);
CREATE INDEX idx_tax_jurisdictions_active ON tax_jurisdictions(is_active) WHERE is_active = TRUE;

-- Trigger para updated_at
CREATE TRIGGER update_tax_jurisdictions_updated_at 
    BEFORE UPDATE ON tax_jurisdictions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();