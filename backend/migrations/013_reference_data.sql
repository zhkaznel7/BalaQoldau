-- Administrative units: Kazakhstan Bureau of National Statistics, 1 July 2026.
-- https://stat.gov.kz/ru/industries/social-statistics/demography/publications/
-- Application slugs are stable IDs, not official KATO codes. No program assignments.
INSERT INTO balaqoldau.regions(slug,name) VALUES
 ('abay','Абай облысы'),('akmola','Ақмола облысы'),('aktobe','Ақтөбе облысы'),
 ('almaty-region','Алматы облысы'),('atyrau','Атырау облысы'),
 ('west-kazakhstan','Батыс Қазақстан облысы'),('zhambyl','Жамбыл облысы'),
 ('zhetisu','Жетісу облысы'),('karaganda','Қарағанды облысы'),('kostanay','Қостанай облысы'),
 ('kyzylorda','Қызылорда облысы'),('mangystau','Маңғыстау облысы'),('pavlodar','Павлодар облысы'),
 ('north-kazakhstan','Солтүстік Қазақстан облысы'),('turkistan','Түркістан облысы'),
 ('ulytau','Ұлытау облысы'),('east-kazakhstan','Шығыс Қазақстан облысы'),
 ('astana','Астана қаласы'),('almaty-city','Алматы қаласы'),('shymkent','Шымкент қаласы')
ON CONFLICT(slug) DO NOTHING;

-- Product support-interest taxonomy, NOT statutory family status or eligibility rules.
-- The existing matching model compares these tags only after independent source review.
INSERT INTO balaqoldau.family_categories(slug,name) VALUES
 ('education-support','Оқуға қолдау'),('creative-development','Шығармашылық даму'),
 ('sports-activities','Спортпен айналысу')
ON CONFLICT(slug) DO NOTHING;
