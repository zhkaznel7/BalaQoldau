-- Stable public navigation taxonomy, not program or eligibility data.
-- Preserve any existing operator-supplied category names.
INSERT INTO balaqoldau.categories (slug,name) VALUES
  ('benefits','Жәрдемақылар'),
  ('free-courses','Тегін курстар'),
  ('grants','Гранттар'),
  ('clubs','Үйірмелер')
ON CONFLICT (slug) DO NOTHING;
