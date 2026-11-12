CREATE FUNCTION balaqoldau.revoke_admin_on_disable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.disabled AND NOT OLD.disabled THEN
    NEW.credential_version := OLD.credential_version + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_disable_revocation BEFORE UPDATE OF disabled
  ON balaqoldau.admin_users FOR EACH ROW EXECUTE FUNCTION balaqoldau.revoke_admin_on_disable();
