-- database/migrations/003_create_firm_members_table.sql

-- Crear enum para roles si no existe
DO $$ BEGIN
    CREATE TYPE firm_role AS ENUM ('owner', 'associated', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de miembros de estudios contables (relación many-to-many)
CREATE TABLE firm_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Roles granulares
    role firm_role NOT NULL DEFAULT 'member',
    
    -- Permisos específicos (JSON para flexibilidad futura)
    permissions JSONB DEFAULT '{}',
    
    -- Estado de la membresía
    is_active BOOLEAN DEFAULT TRUE,
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Datos de invitación
    invitation_token UUID,
    invitation_expires_at TIMESTAMP,
    invitation_accepted_at TIMESTAMP,
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(firm_id, user_id), -- Un usuario solo puede tener un rol por estudio
    CONSTRAINT valid_invitation_expiry CHECK (
        invitation_expires_at IS NULL OR 
        invitation_expires_at > created_at
    )
);

-- Índices para optimizar consultas comunes
CREATE INDEX idx_firm_members_firm_id ON firm_members(firm_id);
CREATE INDEX idx_firm_members_user_id ON firm_members(user_id);
CREATE INDEX idx_firm_members_role ON firm_members(role);
CREATE INDEX idx_firm_members_active ON firm_members(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_firm_members_invitation_token ON firm_members(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_firm_members_permissions ON firm_members USING gin(permissions);

-- Trigger para updated_at
CREATE TRIGGER update_firm_members_updated_at 
    BEFORE UPDATE ON firm_members 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para asegurar que siempre haya al menos un owner por estudio
CREATE OR REPLACE FUNCTION ensure_firm_has_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está eliminando o desactivando el último owner
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_active = FALSE)) 
       AND OLD.role = 'owner' THEN
        
        -- Verificar si quedan otros owners activos
        IF NOT EXISTS (
            SELECT 1 FROM firm_members 
            WHERE firm_id = OLD.firm_id 
            AND role = 'owner' 
            AND is_active = TRUE 
            AND id != OLD.id
        ) THEN
            RAISE EXCEPTION 'No se puede eliminar el último propietario del estudio contable';
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para proteger el último owner
CREATE TRIGGER ensure_firm_owner_exists
    BEFORE UPDATE OR DELETE ON firm_members
    FOR EACH ROW EXECUTE FUNCTION ensure_firm_has_owner();