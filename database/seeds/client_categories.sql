-- database/seeds/client_categories.sql
-- Categorías fiscales estándar argentinas para estudios contables

-- Verificar que las tablas necesarias existan, si no, salir silenciosamente
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Contar tablas necesarias
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('client_categories', 'accounting_firms', 'firm_members');
    
    -- Solo continuar si existen las 3 tablas
    IF table_count < 3 THEN
        RAISE NOTICE 'No existen todas las tablas necesarias (encontradas: %), saltando seed client_categories', table_count;
        RETURN;
    END IF;
    
    -- Si llegamos aquí, todas las tablas existen
    RAISE NOTICE 'Todas las tablas necesarias existen, continuando con seed';
    
    -- Verificar si ya hay datos
    IF EXISTS (SELECT 1 FROM client_categories LIMIT 1) THEN
        RAISE NOTICE 'Ya existen categorías de clientes, saltando seed';
        RETURN;
    END IF;
    
    -- Solo insertar si no hay estudios creados aún
    IF NOT EXISTS (SELECT 1 FROM accounting_firms LIMIT 1) THEN
        RAISE NOTICE 'No hay estudios contables creados aún, saltando seed';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Condiciones cumplidas, ejecutando inserts...';
END $$;

-- Los inserts van fuera del bloque DO para evitar problemas de scope
-- Solo se ejecutarán si el bloque anterior no hizo RETURN

-- Categoría Monotributista
INSERT INTO client_categories (
    firm_id, name, description, tax_category, requires_cuit, requires_iva_registration,
    max_annual_income, can_issue_invoices, invoice_types_allowed, default_due_settings,
    created_by
)
SELECT 
    af.id as firm_id,
    'Monotributista' as name,
    'Pequeños contribuyentes del Régimen Simplificado' as description,
    'monotributo' as tax_category,
    true as requires_cuit,
    false as requires_iva_registration,
    4800000 as max_annual_income,
    true as can_issue_invoices,
    '{B,C,E}' as invoice_types_allowed,
    '{"monthly_due": 20, "quarterly_summary": true}' as default_due_settings,
    fm.user_id as created_by
FROM accounting_firms af
JOIN firm_members fm ON af.id = fm.firm_id AND fm.role = 'owner'
WHERE NOT EXISTS (
    SELECT 1 FROM client_categories cc 
    WHERE cc.firm_id = af.id AND cc.name = 'Monotributista'
);

-- Categoría Responsable Inscripto
INSERT INTO client_categories (
    firm_id, name, description, tax_category, requires_cuit, requires_iva_registration,
    max_annual_income, can_issue_invoices, invoice_types_allowed, default_due_settings,
    created_by
)
SELECT 
    af.id as firm_id,
    'Responsable Inscripto' as name,
    'Contribuyentes inscriptos en IVA' as description,
    'responsable_inscripto' as tax_category,
    true as requires_cuit,
    true as requires_iva_registration,
    NULL as max_annual_income,
    true as can_issue_invoices,
    '{A,B,C,E,M}' as invoice_types_allowed,
    '{"iva_monthly": 20, "ganancias_monthly": 20, "libro_iva": 20}' as default_due_settings,
    fm.user_id as created_by
FROM accounting_firms af
JOIN firm_members fm ON af.id = fm.firm_id AND fm.role = 'owner'
WHERE NOT EXISTS (
    SELECT 1 FROM client_categories cc 
    WHERE cc.firm_id = af.id AND cc.name = 'Responsable Inscripto'
);

-- Categoría Exento
INSERT INTO client_categories (
    firm_id, name, description, tax_category, requires_cuit, requires_iva_registration,
    max_annual_income, can_issue_invoices, invoice_types_allowed, default_due_settings,
    created_by
)
SELECT 
    af.id as firm_id,
    'Exento' as name,
    'Contribuyentes exentos de IVA' as description,
    'exento' as tax_category,
    true as requires_cuit,
    false as requires_iva_registration,
    NULL as max_annual_income,
    true as can_issue_invoices,
    '{B,C,E}' as invoice_types_allowed,
    '{}' as default_due_settings,
    fm.user_id as created_by
FROM accounting_firms af
JOIN firm_members fm ON af.id = fm.firm_id AND fm.role = 'owner'
WHERE NOT EXISTS (
    SELECT 1 FROM client_categories cc 
    WHERE cc.firm_id = af.id AND cc.name = 'Exento'
);