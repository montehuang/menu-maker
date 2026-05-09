-- Dish categories
CREATE TABLE dish_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Ingredients definition
CREATE TABLE ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  unit        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Current inventory
CREATE TABLE inventory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ingredient_id)
);

-- Meal generation sessions
CREATE TABLE meal_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note                TEXT,
  inventory_snapshot  JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- AI recommended dishes
CREATE TABLE meal_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES meal_sessions(id) ON DELETE CASCADE,
  meal_type        TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  dish_name        TEXT NOT NULL,
  category_id      UUID REFERENCES dish_categories(id) ON DELETE SET NULL,
  description      TEXT,
  cooking_steps    TEXT,
  ingredients_used JSONB NOT NULL DEFAULT '[]',
  reference_links  JSONB NOT NULL DEFAULT '[]',
  is_selected      BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Inventory change log
CREATE TABLE inventory_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  change_amount     DECIMAL(10, 2) NOT NULL,
  change_type       TEXT NOT NULL CHECK (change_type IN ('purchase', 'cook', 'manual', 'expire')),
  recommendation_id UUID REFERENCES meal_recommendations(id) ON DELETE SET NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inventory_ingredient ON inventory(ingredient_id);
CREATE INDEX idx_recommendations_session ON meal_recommendations(session_id);
CREATE INDEX idx_logs_ingredient ON inventory_logs(ingredient_id);
CREATE INDEX idx_logs_created ON inventory_logs(created_at DESC);
CREATE INDEX idx_sessions_created ON meal_sessions(created_at DESC);

-- Row Level Security
ALTER TABLE dish_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON dish_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON meal_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON meal_recommendations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inventory_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: default dish categories
INSERT INTO dish_categories (name, sort_order) VALUES
  ('中餐', 1),
  ('西餐', 2),
  ('日料', 3),
  ('快手菜', 4),
  ('白人饭', 5);

-- Auto-update inventory.updated_at
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();
