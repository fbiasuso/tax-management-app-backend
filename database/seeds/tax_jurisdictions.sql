-- database/seeds/tax_jurisdictions.sql
-- Jurisdicciones fiscales de Argentina

-- Insertar jurisdicciones iniciales (usar ON CONFLICT para evitar duplicados)
INSERT INTO tax_jurisdictions (code, name, full_name, type, website, default_due_day) VALUES

-- Federal
('AFIP', 'AFIP', 'Administración Federal de Ingresos Públicos', 'federal', 'https://www.afip.gob.ar', 20),

-- Principales provincias argentinas
('ARBA', 'ARBA', 'Agencia de Recaudación de la Provincia de Buenos Aires', 'provincial', 'https://www.arba.gov.ar', 10),
('AGIP', 'AGIP', 'Administración Gubernamental de Ingresos Públicos (CABA)', 'provincial', 'https://www.agip.gob.ar', 15),
('CBA', 'Córdoba', 'Dirección General de Rentas de Córdoba', 'provincial', 'https://rentas.cba.gov.ar', 10),
('SF', 'Santa Fe', 'Administración Provincial de Impuestos de Santa Fe', 'provincial', 'https://www.santafe.gob.ar/api', 10),
('MZA', 'Mendoza', 'Administración Tributaria de Mendoza', 'provincial', 'https://www.atm.mendoza.gov.ar', 10),
('TUC', 'Tucumán', 'Dirección de Rentas de Tucumán', 'provincial', 'https://rentas.tucuman.gov.ar', 10),
('SL', 'San Luis', 'Dirección Provincial de Rentas de San Luis', 'provincial', 'https://www.rentas.sanluis.gov.ar', 10),
('ER', 'Entre Ríos', 'Dirección General de Rentas de Entre Ríos', 'provincial', 'https://www.entrerios.gov.ar/dgr', 10),
('CHACO', 'Chaco', 'Administración Tributaria Provincial del Chaco', 'provincial', 'https://www.chaco.gov.ar/atp', 10),
('SALTA', 'Salta', 'Dirección General de Rentas de Salta', 'provincial', 'https://www.salta.gov.ar/rentas', 10),
('SJ', 'San Juan', 'Dirección de Rentas de San Juan', 'provincial', 'https://rentas.sanjuan.gob.ar', 10),
('MSN', 'Misiones', 'Dirección General de Rentas de Misiones', 'provincial', 'https://www.dgrmisiones.gov.ar', 10),
('COR', 'Corrientes', 'Dirección General de Rentas de Corrientes', 'provincial', 'https://www.corrientes.gov.ar/rentas', 10),
('FORMOSA', 'Formosa', 'Dirección de Rentas de Formosa', 'provincial', 'https://www.formosa.gob.ar/rentas', 10),
('LP', 'La Pampa', 'Dirección General de Rentas de La Pampa', 'provincial', 'https://www.lapampa.gov.ar/rentas', 10),
('RN', 'Río Negro', 'Dirección General de Rentas de Río Negro', 'provincial', 'https://www.rionegro.gov.ar/rentas', 10),
('NEU', 'Neuquén', 'Dirección Provincial de Rentas de Neuquén', 'provincial', 'https://www.neuquen.gov.ar/rentas', 10),
('CHU', 'Chubut', 'Dirección General de Rentas de Chubut', 'provincial', 'https://www.chubut.gov.ar/rentas', 10),
('SC', 'Santa Cruz', 'Dirección Provincial de Rentas de Santa Cruz', 'provincial', 'https://www.santacruz.gov.ar/rentas', 10),
('TDF', 'Tierra del Fuego', 'Dirección General de Rentas de Tierra del Fuego', 'provincial', 'https://www.tierradelfuego.gov.ar/rentas', 10),
('CAT', 'Catamarca', 'Dirección General de Rentas de Catamarca', 'provincial', 'https://www.catamarca.gov.ar/rentas', 10),
('LR', 'La Rioja', 'Dirección General de Rentas de La Rioja', 'provincial', 'https://www.larioja.gov.ar/rentas', 10),
('JUJUY', 'Jujuy', 'Dirección Provincial de Rentas de Jujuy', 'provincial', 'https://www.jujuy.gov.ar/rentas', 10),
('SGO', 'Santiago del Estero', 'Dirección General de Rentas de Santiago del Estero', 'provincial', 'https://www.sde.gov.ar/rentas', 10)

ON CONFLICT (code) DO NOTHING;