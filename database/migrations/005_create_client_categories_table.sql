-- database/migrations/005_create_client_categories_table.sql

-- Crear enum para tipos de categorías fiscales argentinas (con manejo de duplicados)
DO $$ 
BEGIN
    CREATE TYPE tax_category_type AS ENUM (
        'monotributo', 
        'responsable_inscripto', 
        'responsable_no_inscripto',
        'exento',
        'consumidor_final',
        'sujeto_no_categorizado',
        'pequeno_contribuyente_eventual',
        'monotributo_social',
        'pequeno_contribuyente_eventual_social'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'El tipo tax_category_type ya existe, continuando...';
END $$;

-- Tabla de categorías fiscales de clientes
CREATE TABLE client_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id) ON DELETE CASCADE,
    
    -- Información básica de la categoría
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Tipo de categoría fiscal según AFIP
    tax_category tax_category_type NOT NULL,
    
    -- Configuración específica de la categoría
    requires_cuit BOOLEAN DEFAULT TRUE,
    requires_iva_registration BOOLEAN DEFAULT FALSE,
    max_annual_income DECIMAL(15,2), -- Para monotributo
    
    -- Configuración de vencimientos por defecto
    default_due_settings JSONB DEFAULT '{}', -- Configuraciones específicas por módulo
    
    -- Configuración de facturación
    can_issue_invoices BOOLEAN DEFAULT TRUE,
    invoice_types_allowed VARCHAR(50)[] DEFAULT ARRAY['A','B','C','E'],
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadatos
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_category_name CHECK (LENGTH(name) >= 3),
    CONSTRAINT valid_max_income CHECK (max_annual_income IS NULL OR max_annual_income > 0),
    UNIQUE(firm_id, name) -- Nombres únicos por estudio
);

-- Índices
CREATE INDEX idx_client_categories_firm_id ON client_categories(firm_id);
CREATE INDEX idx_client_categories_tax_category ON client_categories(tax_category);
CREATE INDEX idx_client_categories_active ON client_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_client_categories_created_by ON client_categories(created_by);
CREATE INDEX idx_client_categories_due_settings ON client_categories USING gin(default_due_settings);

-- Trigger para updated_at
CREATE TRIGGER update_client_categories_updated_at 
    BEFORE UPDATE ON client_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();