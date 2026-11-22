-- Optional self-declared context, never a verified eligibility decision.
ALTER TABLE balaqoldau.user_accounts ADD COLUMN family_context jsonb;
ALTER TABLE balaqoldau.child_profiles ADD COLUMN family_context jsonb;
ALTER TABLE balaqoldau.user_accounts ADD CONSTRAINT user_family_context_check CHECK(family_context IS NULL OR (
 jsonb_typeof(family_context)='object' AND length(family_context::text)<=1024
 AND family_context-ARRAY['childrenCount','singleParent','largeFamily','disabilitySupportEligible','supportNeeds']='{}'::jsonb
 AND CASE WHEN family_context->>'childrenCount' IS NULL THEN true
   WHEN jsonb_typeof(family_context->'childrenCount')='number' AND (family_context->>'childrenCount')~'^(0|[1-9][0-9]?)$' THEN (family_context->>'childrenCount')::int<=30 ELSE false END
 AND COALESCE(jsonb_typeof(family_context->'singleParent') IN('null','boolean'),true)
 AND COALESCE(jsonb_typeof(family_context->'largeFamily') IN('null','boolean'),true)
 AND COALESCE(jsonb_typeof(family_context->'disabilitySupportEligible') IN('null','boolean'),true)
 AND CASE WHEN NOT family_context?'supportNeeds' THEN true WHEN jsonb_typeof(family_context->'supportNeeds')='array'
   THEN jsonb_array_length(family_context->'supportNeeds')<=3 AND family_context->'supportNeeds'<@'["education-support","creative-development","sports-activities"]'::jsonb ELSE false END));
ALTER TABLE balaqoldau.child_profiles ADD CONSTRAINT child_family_context_check CHECK(family_context IS NULL OR (
 jsonb_typeof(family_context)='object' AND length(family_context::text)<=1024
 AND family_context-ARRAY['disabilitySupportEligible','supportNeeds']='{}'::jsonb
 AND COALESCE(jsonb_typeof(family_context->'disabilitySupportEligible') IN('null','boolean'),true)
 AND CASE WHEN NOT family_context?'supportNeeds' THEN true WHEN jsonb_typeof(family_context->'supportNeeds')='array'
   THEN jsonb_array_length(family_context->'supportNeeds')<=3 AND family_context->'supportNeeds'<@'["education-support","creative-development","sports-activities"]'::jsonb ELSE false END));
