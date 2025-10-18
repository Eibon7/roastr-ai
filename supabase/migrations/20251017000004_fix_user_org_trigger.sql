-- Fix create_user_organization trigger to map 'basic' plan to 'free' for organizations
-- Issue: Users table uses 'basic' but organizations table uses 'free'

CREATE OR REPLACE FUNCTION create_user_organization()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_email_prefix VARCHAR;
    org_plan_id VARCHAR;
BEGIN
    -- Extract prefix from email for slug
    user_email_prefix := split_part(NEW.email, '@', 1);
    user_email_prefix := regexp_replace(user_email_prefix, '[^a-z0-9]', '-', 'g');
    user_email_prefix := trim(both '-' from user_email_prefix);

    -- Map user plan to organization plan (basic → free)
    org_plan_id := CASE NEW.plan
        WHEN 'basic' THEN 'free'
        ELSE NEW.plan
    END;

    -- Create organization for the user
    INSERT INTO organizations (name, slug, owner_id, plan_id, monthly_responses_limit)
    VALUES (
        COALESCE(NEW.name, NEW.email) || '''s Organization',
        user_email_prefix || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER::TEXT,
        NEW.id,
        org_plan_id,
        CASE org_plan_id
            WHEN 'free' THEN 100
            WHEN 'pro' THEN 1000
            WHEN 'creator_plus' THEN 5000
            ELSE 999999
        END
    )
    RETURNING id INTO org_id;

    -- Add user as organization member
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (org_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
