-- database/migrations/002_create_accounting_firms_table.sql

-- Tabla de estudios contables
CREATE TABLE accounting_firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    
    -- Datos fiscales del estudio
    cuit VARCHAR(13), -- CUIT del estudio contable
    tax_id_type VARCHAR(20) CHECK (tax_id_type IN ('CUIT', 'CUIL', 'CDI')),
    
    -- Información de contacto
    address VARCHAR(300),
    city VARCHAR(100),
    province VARCHAR(50),
    postal_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    
    -- Configuración del estudio
    timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    default_jurisdiction VARCHAR(50) DEFAULT 'AFIP', -- AFIP, ARBA, etc.
    
    -- Estado y metadatos
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_firm_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    CONSTRAINT valid_firm_cuit CHECK (cuit IS NULL OR cuit ~ '^\d{2}-\d{8}-\d{1}$'),
    CONSTRAINT valid_firm_name CHECK (LENGTH(name) >= 3)
);

-- Índices
CREATE INDEX idx_accounting_firms_name ON accounting_firms(name);
CREATE INDEX idx_accounting_firms_cuit ON accounting_firms(cuit) WHERE cuit IS NOT NULL;
CREATE INDEX idx_accounting_firms_created_by ON accounting_firms(created_by);
CREATE INDEX idx_accounting_firms_active ON accounting_firms(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_accounting_firms_province ON accounting_firms(province);

-- Trigger para updated_at
CREATE TRIGGER update_accounting_firms_updated_at 
    BEFORE UPDATE ON accounting_firms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();