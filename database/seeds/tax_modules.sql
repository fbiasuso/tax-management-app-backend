-- database/seeds/tax_modules.sql
-- Módulos fiscales más importantes de Argentina

-- Insertar módulos AFIP principales
INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'F746' as code,
    'Monotributo Mensual' as name,
    'Declaración jurada mensual del Régimen Simplificado para Pequeños Contribuyentes' as description,
    'tax_return' as module_type,
    'monthly' as frequency,
    20 as due_day,
    'monotributo' as applicable_categories_text,
    5 as notification_days_before,
    '{"form_url": "https://monotributo.afip.gob.ar", "instructions": "Completar facturación mensual"}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.code = 'AFIP'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'F731' as code,
    'IVA Mensual' as name,
    'Declaración jurada mensual de IVA' as description,
    'tax_return' as module_type,
    'monthly' as frequency,
    20 as due_day,
    'responsable_inscripto' as applicable_categories_text,
    7 as notification_days_before,
    '{"form_url": "https://www.afip.gob.ar/formularios/", "requires_libro_iva": true}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.code = 'AFIP'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'RG4540' as code,
    'Libro IVA Digital' as name,
    'Régimen de Información de Compras y Ventas' as description,
    'information_return' as module_type,
    'monthly' as frequency,
    20 as due_day,
    'responsable_inscripto' as applicable_categories_text,
    5 as notification_days_before,
    '{"system_url": "https://www.afip.gob.ar/libro-iva-digital/", "automated": true}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.code = 'AFIP'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'F931' as code,
    'Ganancias Personas Jurídicas' as name,
    'Declaración jurada anual de Ganancias - Personas Jurídicas' as description,
    'tax_return' as module_type,
    'annual' as frequency,
    15 as due_day,
    'responsable_inscripto' as applicable_categories_text,
    30 as notification_days_before,
    '{"due_month": 5, "form_url": "https://www.afip.gob.ar/gananciasJuridicas/"}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.code = 'AFIP'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'F770' as code,
    'Bienes Personales' as name,
    'Declaración jurada anual de Bienes Personales' as description,
    'tax_return' as module_type,
    'annual' as frequency,
    15 as due_day,
    'responsable_inscripto' as applicable_categories_text,
    30 as notification_days_before,
    '{"due_month": 5, "min_patrimony_threshold": 18000000}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.code = 'AFIP'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- Insertar módulos provinciales simplificados
INSERT INTO tax_modules (
    jurisdiction_id, code, name, description, module_type, frequency, 
    due_day, applicable_categories_text, notification_days_before, form_settings
)
SELECT 
    tj.id as jurisdiction_id,
    'IB_MONTHLY' as code,
    'Ingresos Brutos Mensual' as name,
    'Declaración jurada mensual de Ingresos Brutos' as description,
    'tax_return' as module_type,
    'monthly' as frequency,
    15 as due_day,
    'responsable_inscripto,responsable_no_inscripto' as applicable_categories_text,
    5 as notification_days_before,
    '{"provincial_tax": true}' as form_settings
FROM tax_jurisdictions tj 
WHERE tj.type = 'provincial' 
ON CONFLICT (jurisdiction_id, code) DO NOTHING;