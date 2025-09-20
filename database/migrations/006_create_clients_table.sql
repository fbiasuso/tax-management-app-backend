-- database/migrations/006_create_clients_table.sql

-- Crear enum para tipos de persona
DO $$ BEGIN
    CREATE TYPE person_type AS ENUM ('fisica', 'juridica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla principal de clientes
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id) ON DELETE CASCADE,
    category_id UUID, -- Se agregará constraint después cuando exista client_categories
    
    -- Información básica del cliente
    business_name VARCHAR(300) NOT NULL, -- Razón social o nombre completo
    fantasy_name VARCHAR(300), -- Nombre de fantasía
    person_type person_type NOT NULL DEFAULT 'fisica',
    
    -- Identificación fiscal
    cuit VARCHAR(13) UNIQUE, -- CUIT/CUIL/CDI (formato: XX-XXXXXXXX-X)
    tax_id_type VARCHAR(10) DEFAULT 'CUIT' CHECK (tax_id_type IN ('CUIT', 'CUIL', 'CDI')),
    
    -- Información de contacto
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    
    -- Domicilio fiscal
    fiscal_address VARCHAR(400) NOT NULL,
    fiscal_city VARCHAR(100) NOT NULL,
    fiscal_province VARCHAR(50) NOT NULL,
    fiscal_postal_code VARCHAR(10),
    
    -- Domicilio comercial (opcional)
    commercial_address VARCHAR(400),
    commercial_city VARCHAR(100),
    commercial_province VARCHAR(50),
    commercial_postal_code VARCHAR(10),
    
    -- Información fiscal específica
    iva_condition VARCHAR(50), -- Responsable Inscripto, Monotributista, etc.
    gross_income_registration VARCHAR(50), -- Número de IIBB
    start_activities_date DATE, -- Fecha de inicio de actividades
    
    -- Actividad económica
    primary_activity_code VARCHAR(10), -- Código de actividad AFIP
    primary_activity_description VARCHAR(200),
    secondary_activities JSONB DEFAULT '[]', -- Array de actividades secundarias
    
    -- Configuración de facturación
    invoice_settings JSONB DEFAULT '{}',
    
    -- Estado del cliente
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Metadatos
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_business_name CHECK (LENGTH(business_name) >= 3),
    CONSTRAINT valid_cuit_format CHECK (cuit IS NULL OR cuit ~ '^\d{2}-\d{8}-\d{1}$'),
    CONSTRAINT valid_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    CONSTRAINT valid_start_date CHECK (start_activities_date IS NULL OR start_activities_date <= CURRENT_DATE),
    CONSTRAINT valid_fiscal_address CHECK (LENGTH(fiscal_address) >= 10),
    UNIQUE(firm_id, cuit) -- CUIT único por estudio (permite NULL)
);

-- Índices para optimizar consultas
CREATE INDEX idx_clients_firm_id ON clients(firm_id);
CREATE INDEX idx_clients_category_id ON clients(category_id);
CREATE INDEX idx_clients_cuit ON clients(cuit) WHERE cuit IS NOT NULL;
CREATE INDEX idx_clients_business_name ON clients(business_name);
CREATE INDEX idx_clients_fantasy_name ON clients(fantasy_name) WHERE fantasy_name IS NOT NULL;
CREATE INDEX idx_clients_person_type ON clients(person_type);
CREATE INDEX idx_clients_iva_condition ON clients(iva_condition);
CREATE INDEX idx_clients_active ON clients(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_clients_province ON clients(fiscal_province);
CREATE INDEX idx_clients_activity_code ON clients(primary_activity_code);
CREATE INDEX idx_clients_secondary_activities ON clients USING gin(secondary_activities);
CREATE INDEX idx_clients_invoice_settings ON clients USING gin(invoice_settings);

-- Índice de texto completo para búsqueda
CREATE INDEX idx_clients_search ON clients USING gin(
    to_tsvector('spanish', 
        COALESCE(business_name, '') || ' ' || 
        COALESCE(fantasy_name, '') || ' ' || 
        COALESCE(cuit, '') || ' ' ||
        COALESCE(primary_activity_description, '')
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();