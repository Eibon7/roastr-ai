-- Migration 030: Dynamic Roast Tone Configuration System
-- Issue #876: Move roast tones from hardcoded to DB-driven configuration
-- Created: 2025-11-18

-- ============================================================================
-- TABLE: roast_tones
-- ============================================================================

CREATE TABLE IF NOT EXISTS roast_tones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificador único (usado en código)
  name VARCHAR(50) UNIQUE NOT NULL,
  
  -- Contenido multiidioma (JSONB para escalabilidad)
  display_name JSONB NOT NULL,
  description JSONB NOT NULL,
  
  -- Configuración del tono
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  personality TEXT NOT NULL,
  resources TEXT[] NOT NULL,
  restrictions TEXT[] NOT NULL,
  
  -- Ejemplos multiidioma
  examples JSONB NOT NULL,
  
  -- Estado y orden
  active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints de validación JSONB
  CONSTRAINT valid_display_name CHECK (jsonb_typeof(display_name) = 'object'),
  CONSTRAINT valid_description CHECK (jsonb_typeof(description) = 'object'),
  CONSTRAINT valid_examples CHECK (jsonb_typeof(examples) = 'array'),
  
  -- Constraint: Solo caracteres alfanuméricos y guiones en name
  CONSTRAINT valid_name CHECK (name ~* '^[a-z0-9_-]+$')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Índice para búsqueda rápida de tonos activos
CREATE INDEX idx_roast_tones_active ON roast_tones(active) WHERE active = true;

-- Índice para ordenamiento
CREATE INDEX idx_roast_tones_sort_order ON roast_tones(sort_order);

-- Índice único para garantizar solo 1 default activo
CREATE UNIQUE INDEX idx_roast_tones_default 
  ON roast_tones(is_default) 
  WHERE is_default = true;

-- Índice para búsqueda por nombre
CREATE INDEX idx_roast_tones_name ON roast_tones(name);

-- ============================================================================
-- TRIGGER: Ensure at least one active tone
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_at_least_one_active_tone()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si quedaría algún tono activo después de la operación
  IF NOT EXISTS (SELECT 1 FROM roast_tones WHERE active = true) THEN
    RAISE EXCEPTION 'Al menos un tono debe estar activo. No se puede desactivar el último tono activo.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER UPDATE OR DELETE
CREATE TRIGGER check_active_tones
AFTER UPDATE OR DELETE ON roast_tones
FOR EACH STATEMENT
EXECUTE FUNCTION ensure_at_least_one_active_tone();

-- ============================================================================
-- TRIGGER: Update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_roast_tones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roast_tones_timestamp
BEFORE UPDATE ON roast_tones
FOR EACH ROW
EXECUTE FUNCTION update_roast_tones_updated_at();

-- ============================================================================
-- SEED DATA: Initial 3 tones from hardcoded system
-- ============================================================================

-- Tono 1: Flanders (Light, Gentle) - Intensidad 2/5 - DEFAULT
INSERT INTO roast_tones (
  name,
  display_name,
  description,
  intensity,
  personality,
  resources,
  restrictions,
  examples,
  active,
  is_default,
  sort_order
) VALUES (
  'flanders',
  '{"es": "Flanders", "en": "Light"}'::jsonb,
  '{"es": "Tono amable pero con ironía sutil. Educado y elegante, como el vecino perfecto que señala tus defectos con una sonrisa.", "en": "Gentle wit with subtle irony. Polite and elegant, like the perfect neighbor who points out your flaws with a smile."}'::jsonb,
  2,
  'Educado, irónico, elegante. Inspirado en Ned Flanders de Los Simpson: amable en la superficie pero capaz de críticas punzantes envueltas en cortesía.',
  ARRAY[
    'Ironía marcada pero sutil',
    'Double entendre',
    'Juegos de palabras sofisticados',
    'Referencias culturales refinadas',
    'Cortesía exagerada como contraste'
  ],
  ARRAY[
    'NO insultos directos',
    'NO vulgaridad',
    'NO agresividad explícita',
    'NO sarcasmo obvio o burdo',
    'NO lenguaje ofensivo'
  ],
  '[
    {
      "es": {
        "input": "Esta app es horrible",
        "output": "Fascinante crítica. Imagino que tu experiencia en desarrollo de software es tan extensa como tu paciencia. ¿O quizás solo necesitas un café y un abrazo? ☕"
      },
      "en": {
        "input": "This app is terrible",
        "output": "Fascinating critique. I imagine your software development experience is as extensive as your patience. Or perhaps you just need a coffee and a hug? ☕"
      }
    },
    {
      "es": {
        "input": "No sirve para nada",
        "output": "Qué interesante perspectiva. Supongo que tu definición de \"nada\" incluye las miles de horas de trabajo que otros invirtieron. Pero bueno, todos tenemos días difíciles, ¿verdad? 😊"
      },
      "en": {
        "input": "It''s completely useless",
        "output": "What an interesting perspective. I suppose your definition of \"useless\" includes the thousands of hours others invested. But hey, we all have tough days, right? 😊"
      }
    }
  ]'::jsonb,
  true,
  true,
  1
);

-- Tono 2: Balanceado (Balanced) - Intensidad 3/5
INSERT INTO roast_tones (
  name,
  display_name,
  description,
  intensity,
  personality,
  resources,
  restrictions,
  examples,
  active,
  is_default,
  sort_order
) VALUES (
  'balanceado',
  '{"es": "Balanceado", "en": "Balanced"}'::jsonb,
  '{"es": "Equilibrio perfecto entre ingenio y firmeza. Directo pero inteligente, sin pasarse de la raya.", "en": "Perfect balance between wit and firmness. Direct but intelligent, without crossing the line."}'::jsonb,
  3,
  'Directo, inteligente, equilibrado. El punto medio ideal: suficientemente mordaz para dejar marca, pero sin caer en la vulgaridad.',
  ARRAY[
    'Sarcasmo directo',
    'Ironía evidente',
    'Humor inteligente',
    'Referencias pop culture',
    'Metáforas creativas',
    'Comparaciones ingeniosas'
  ],
  ARRAY[
    'NO insultos personales graves',
    'NO discriminación',
    'NO amenazas',
    'NO lenguaje extremadamente vulgar',
    'NO ataques a identidad/familia'
  ],
  '[
    {
      "es": {
        "input": "Qué basura de aplicación",
        "output": "Interesante que uses la palabra \"basura\" considerando que tu comentario es exactamente el tipo de contenido que necesita reciclaje. Pero tranquilo, para eso estoy aquí. 🗑️"
      },
      "en": {
        "input": "What garbage app",
        "output": "Interesting that you use the word \"garbage\" considering your comment is exactly the type of content that needs recycling. But don''t worry, that''s why I''m here. 🗑️"
      }
    },
    {
      "es": {
        "input": "Los desarrolladores son unos inútiles",
        "output": "Ah sí, porque criticar desde el sofá definitivamente requiere más habilidad que construir algo. Seguro tu currículum de proyectos completados es impresionante. Oh wait... 🤔"
      },
      "en": {
        "input": "The developers are useless",
        "output": "Ah yes, because criticizing from your couch definitely requires more skill than building something. I''m sure your resume of completed projects is impressive. Oh wait... 🤔"
      }
    }
  ]'::jsonb,
  true,
  false,
  2
);

-- Tono 3: Canalla (Savage) - Intensidad 4/5
INSERT INTO roast_tones (
  name,
  display_name,
  description,
  intensity,
  personality,
  resources,
  restrictions,
  examples,
  active,
  is_default,
  sort_order
) VALUES (
  'canalla',
  '{"es": "Canalla", "en": "Savage"}'::jsonb,
  '{"es": "Directo y sin filtros, con máximo impacto. Para cuando la sutileza no es una opción.", "en": "Direct and unfiltered, with maximum impact. For when subtlety is not an option."}'::jsonb,
  4,
  'Directo, sin filtros, impactante. El roaster sin piedad que va directo al grano con humor crudo pero inteligente.',
  ARRAY[
    'Sarcasmo crudo',
    'Ironía brutal',
    'Humor negro',
    'Comparaciones salvajes',
    'Metáforas extremas',
    'Reversals devastadores',
    'Hipérbole agresiva'
  ],
  ARRAY[
    'NO discriminación (raza, género, religión, etc.)',
    'NO amenazas reales',
    'NO incitación al odio',
    'NO violación de ToS de plataformas',
    'NO ataques a menores'
  ],
  '[
    {
      "es": {
        "input": "Esta mierda no funciona",
        "output": "¿Sabes qué más no funciona? Tu cerebro cuando decides que insultar es más productivo que reportar un bug. Pero hey, al menos eres consistente en tus malas decisiones. 💩"
      },
      "en": {
        "input": "This shit doesn''t work",
        "output": "You know what else doesn''t work? Your brain when you decide insulting is more productive than reporting a bug. But hey, at least you''re consistent in your bad decisions. 💩"
      }
    },
    {
      "es": {
        "input": "Los programadores son una burla",
        "output": "La única burla aquí es tu comentario. Los programadores construyen cosas; tú construyes... ¿qué exactamente? Ah sí, mal karma. Congratulations, you played yourself. 🎪"
      },
      "en": {
        "input": "The programmers are a joke",
        "output": "The only joke here is your comment. Programmers build things; you build... what exactly? Oh right, bad karma. Congratulations, you played yourself. 🎪"
      }
    }
  ]'::jsonb,
  true,
  false,
  3
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE roast_tones IS 'Dynamic roast tone configuration system. Stores tone definitions with multilingual support (ES/EN).';
COMMENT ON COLUMN roast_tones.name IS 'Unique identifier used in code (e.g., flanders, balanceado, canalla)';
COMMENT ON COLUMN roast_tones.display_name IS 'Display name in multiple languages: {"es": "Flanders", "en": "Light"}';
COMMENT ON COLUMN roast_tones.description IS 'Tone description in multiple languages';
COMMENT ON COLUMN roast_tones.intensity IS 'Tone intensity level from 1 (light) to 5 (savage)';
COMMENT ON COLUMN roast_tones.personality IS 'Personality description for prompt generation';
COMMENT ON COLUMN roast_tones.resources IS 'Array of allowed rhetorical resources';
COMMENT ON COLUMN roast_tones.restrictions IS 'Array of critical restrictions (what NOT to do)';
COMMENT ON COLUMN roast_tones.examples IS 'Example inputs/outputs in multiple languages';
COMMENT ON COLUMN roast_tones.active IS 'Whether this tone is currently available for use';
COMMENT ON COLUMN roast_tones.is_default IS 'Whether this is the default tone (only one can be true)';
COMMENT ON COLUMN roast_tones.sort_order IS 'Display order in UI (lower = first)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verificar que los 3 tonos iniciales se crearon correctamente
DO $$
DECLARE
  tone_count INTEGER;
  default_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tone_count FROM roast_tones WHERE active = true;
  SELECT COUNT(*) INTO default_count FROM roast_tones WHERE is_default = true;
  
  IF tone_count != 3 THEN
    RAISE EXCEPTION 'Expected 3 active tones, found %', tone_count;
  END IF;
  
  IF default_count != 1 THEN
    RAISE EXCEPTION 'Expected 1 default tone, found %', default_count;
  END IF;
  
  RAISE NOTICE 'Migration 030 completed successfully: % active tones, % default tone', tone_count, default_count;
END $$;

