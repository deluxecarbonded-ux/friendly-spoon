-- ============================================================================
--  EXOTIC — COMPLETE DATABASE SCHEMA
--  Tables · Columns · Indexes · Row Level Security · Database (Edge) Functions
--  Triggers · LISTEN/NOTIFY realtime broadcast
--
--  Session context variables used by RLS:
--    exotic.account_id : uuid of the authenticated account (set per transaction)
--    exotic.service    : 'on' for trusted server-side operations (auth, boards)
-- ============================================================================

-- ─────────────────────────── CONTENT TABLES ────────────────────────────────
-- Game content (levels / items / achievement definitions). Authored data.

CREATE TABLE IF NOT EXISTS levels (
  id               integer PRIMARY KEY,
  name             text    NOT NULL,
  sub              text    NOT NULL,
  par_seconds      integer NOT NULL,
  deathless_bonus  integer NOT NULL DEFAULT 0,
  sort             integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop_items (
  id          text    PRIMARY KEY,
  category    text    NOT NULL,
  name        text    NOT NULL,
  blurb       text    NOT NULL,
  price       integer NOT NULL DEFAULT 0,
  consumable  boolean NOT NULL DEFAULT false,
  sort        integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS achievements (
  key         text    PRIMARY KEY,
  name        text    NOT NULL,
  description text    NOT NULL,
  sort        integer NOT NULL DEFAULT 0
);

-- ─────────────────────────── IDENTITY TABLES ───────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       text        NOT NULL,
  email          text,
  display_name   text,
  password_hash  text,
  password_salt  text,
  is_guest       boolean     NOT NULL DEFAULT false,
  email_verified boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now()
);

-- Usernames are stored and matched EXACTLY as the user typed them.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_key ON accounts (username);
-- Emails are unique case-insensitively (guests have no email).
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key ON accounts (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_is_guest_idx ON accounts (is_guest);

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- Email verification tokens (single-use, 72h expiry)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_account_idx ON email_verification_tokens (account_id);

-- ─────────────────────────── PLAYER DATA TABLES ────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  account_id   uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  coins        integer     NOT NULL DEFAULT 0,
  total_deaths integer     NOT NULL DEFAULT 0,
  unlock_boost integer     NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  theme      text        NOT NULL DEFAULT 'dark',
  sound      boolean     NOT NULL DEFAULT true,
  volume     integer     NOT NULL DEFAULT 60,
  shake      boolean     NOT NULL DEFAULT true,
  skin       text        NOT NULL DEFAULT 'skin:solid',
  trail      text        NOT NULL DEFAULT 'trail:none',
  taunt      text        NOT NULL DEFAULT 'taunt:classic',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS level_progress (
  account_id   uuid    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  level_id     integer NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  attempts     integer NOT NULL DEFAULT 0,
  best_deaths  integer,
  best_time_ms integer,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, level_id)
);
CREATE INDEX IF NOT EXISTS level_progress_completed_idx ON level_progress (completed);

CREATE TABLE IF NOT EXISTS purchases (
  account_id   uuid    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id      text    NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  qty          integer NOT NULL DEFAULT 1,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, item_id)
);

CREATE TABLE IF NOT EXISTS account_achievements (
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  achievement_key text NOT NULL REFERENCES achievements(key) ON DELETE CASCADE,
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS activity (
  id         bigserial PRIMARY KEY,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  kind       text        NOT NULL,
  detail     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity (created_at DESC);

-- ───────────────────── REALTIME: NOTIFY BROADCAST TRIGGERS ─────────────────
-- Every mutation pushes a compact event onto the `exotic_rt` channel. The
-- Node SSE endpoint LISTENs and fans events out to connected browsers, so the
-- UI updates instantly with no refresh and no navigation.

CREATE OR REPLACE FUNCTION fn_notify_change() RETURNS trigger AS $$
DECLARE
  v_row     jsonb;
  v_account text;
BEGIN
  -- to_jsonb avoids referencing fields that do not exist on every table
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_account := coalesce(v_row ->> 'account_id', v_row ->> 'id');

  PERFORM pg_notify('exotic_rt', jsonb_build_object(
    'table',   TG_TABLE_NAME,
    'op',      TG_OP,
    'account', v_account,
    'at',      extract(epoch from now())
  )::text);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rt_profiles ON profiles;
CREATE TRIGGER trg_rt_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_settings ON settings;
CREATE TRIGGER trg_rt_settings AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_progress ON level_progress;
CREATE TRIGGER trg_rt_progress AFTER INSERT OR UPDATE OR DELETE ON level_progress
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_purchases ON purchases;
CREATE TRIGGER trg_rt_purchases AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_achievements ON account_achievements;
CREATE TRIGGER trg_rt_achievements AFTER INSERT OR UPDATE OR DELETE ON account_achievements
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_accounts ON accounts;
CREATE TRIGGER trg_rt_accounts AFTER UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_activity ON activity;
CREATE TRIGGER trg_rt_activity AFTER INSERT ON activity
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

-- content tables (global, broadcast to all clients)
DROP TRIGGER IF EXISTS trg_rt_levels ON levels;
CREATE TRIGGER trg_rt_levels AFTER INSERT OR UPDATE OR DELETE ON levels
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_shop_items ON shop_items;
CREATE TRIGGER trg_rt_shop_items AFTER INSERT OR UPDATE OR DELETE ON shop_items
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_achievements_def ON achievements;
CREATE TRIGGER trg_rt_achievements_def AFTER INSERT OR UPDATE OR DELETE ON achievements
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

-- sessions (service-only, but still broadcast for completeness)
DROP TRIGGER IF EXISTS trg_rt_sessions ON sessions;
CREATE TRIGGER trg_rt_sessions AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

DROP TRIGGER IF EXISTS trg_rt_email_verification_tokens ON email_verification_tokens;
CREATE TRIGGER trg_rt_email_verification_tokens AFTER INSERT OR DELETE ON email_verification_tokens
  FOR EACH ROW EXECUTE FUNCTION fn_notify_change();

-- ─────────────────── DATABASE (EDGE) FUNCTIONS — GAME LOGIC ────────────────
-- Authoritative server-side logic. The client can never fabricate coins,
-- clears or achievements: every number below is computed here.

-- Bootstrap a brand new account's rows.
CREATE OR REPLACE FUNCTION fn_bootstrap_account(p_account uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('exotic.service', 'on', true);
  INSERT INTO profiles (account_id) VALUES (p_account) ON CONFLICT DO NOTHING;
  INSERT INTO settings (account_id) VALUES (p_account) ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an email verification token. Returns the raw token (store the hash).
CREATE OR REPLACE FUNCTION fn_create_verification_token(p_account uuid, p_expires_hours integer DEFAULT 72)
RETURNS text AS $$
DECLARE
  v_raw    text;
  v_hash   text;
  v_expires timestamptz;
BEGIN
  PERFORM set_config('exotic.service', 'on', true);
  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_raw::bytea), 'hex');
  v_expires := now() + (p_expires_hours || ' hours')::interval;

  DELETE FROM email_verification_tokens WHERE account_id = p_account;
  INSERT INTO email_verification_tokens (account_id, token_hash, expires_at)
  VALUES (p_account, v_hash, v_expires);
  RETURN v_raw;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consume a verification token. Returns the account_id on success, null on failure.
CREATE OR REPLACE FUNCTION fn_verify_email(p_token text)
RETURNS uuid AS $$
DECLARE
  v_hash   text;
  v_row    email_verification_tokens%ROWTYPE;
BEGIN
  PERFORM set_config('exotic.service', 'on', true);
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_row FROM email_verification_tokens
    WHERE token_hash = v_hash AND expires_at > now() LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE accounts SET email_verified = true, last_seen_at = now()
    WHERE id = v_row.account_id;

  DELETE FROM email_verification_tokens WHERE id = v_row.id;
  RETURN v_row.account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unlock an achievement (guests are excluded by design).
CREATE OR REPLACE FUNCTION fn_unlock(p_account uuid, p_key text, INOUT p_fresh text[])
RETURNS text[] AS $$
DECLARE v_guest boolean;
BEGIN
  SELECT is_guest INTO v_guest FROM accounts WHERE id = p_account;
  IF v_guest THEN RETURN; END IF;

  INSERT INTO account_achievements (account_id, achievement_key)
  VALUES (p_account, p_key)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    p_fresh := array_append(p_fresh, p_key);
    INSERT INTO activity (account_id, kind, detail)
    VALUES (p_account, 'achievement', jsonb_build_object('key', p_key));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit a run. Computes rewards, records bests, unlocks achievements.
CREATE OR REPLACE FUNCTION fn_submit_run(
  p_account uuid,
  p_level   integer,
  p_won     boolean,
  p_deaths  integer,
  p_time_ms integer,
  p_coins   integer
) RETURNS jsonb AS $$
DECLARE
  v_level       levels%ROWTYPE;
  v_prev        level_progress%ROWTYPE;
  v_profile     profiles%ROWTYPE;
  v_guest       boolean;
  v_first_clear boolean := false;
  v_earned      integer := 0;
  v_fresh       text[]  := ARRAY[]::text[];
  v_cleared     integer := 0;
  v_total_levels integer;
  v_deaths      integer;
  v_time        integer;
  v_pickups     integer;
  COIN_VALUE    constant integer := 5;
  CLEAR_REWARD  constant integer := 40;
  FIRST_BONUS   constant integer := 60;
  SPEED_BONUS   constant integer := 40;
BEGIN
  PERFORM set_config('exotic.service', 'on', true);

  SELECT * INTO v_level FROM levels WHERE id = p_level;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown level %', p_level; END IF;

  SELECT is_guest INTO v_guest FROM accounts WHERE id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown account'; END IF;

  -- clamp all client-supplied numbers
  v_deaths  := greatest(0, least(9999, coalesce(p_deaths, 0)));
  v_time    := greatest(0, least(3600000, coalesce(p_time_ms, 0)));
  v_pickups := greatest(0, least(500, coalesce(p_coins, 0)));

  SELECT * INTO v_profile FROM profiles WHERE account_id = p_account FOR UPDATE;
  SELECT * INTO v_prev FROM level_progress
    WHERE account_id = p_account AND level_id = p_level FOR UPDATE;

  IF p_won THEN
    v_first_clear := (v_prev.account_id IS NULL) OR (v_prev.completed = false);

    INSERT INTO level_progress (account_id, level_id, completed, attempts, best_deaths, best_time_ms, updated_at)
    VALUES (p_account, p_level, true, 1, v_deaths, v_time, now())
    ON CONFLICT (account_id, level_id) DO UPDATE SET
      completed    = true,
      attempts     = level_progress.attempts + 1,
      best_deaths  = least(coalesce(level_progress.best_deaths, v_deaths), v_deaths),
      best_time_ms = least(coalesce(level_progress.best_time_ms, v_time), v_time),
      updated_at   = now();

    v_earned := v_pickups * COIN_VALUE
              + CLEAR_REWARD
              + CASE WHEN v_first_clear THEN FIRST_BONUS ELSE 0 END
              + CASE WHEN v_deaths = 0 THEN v_level.deathless_bonus ELSE 0 END
              + CASE WHEN v_time > 0 AND v_time <= v_level.par_seconds * 1000 THEN SPEED_BONUS ELSE 0 END;

    INSERT INTO activity (account_id, kind, detail)
    VALUES (p_account, 'clear', jsonb_build_object(
      'level', p_level, 'deaths', v_deaths, 'timeMs', v_time, 'coins', v_earned));
  ELSE
    IF v_prev.account_id IS NOT NULL THEN
      UPDATE level_progress SET attempts = attempts + 1, updated_at = now()
        WHERE account_id = p_account AND level_id = p_level;
    ELSIF v_deaths > 0 THEN
      INSERT INTO level_progress (account_id, level_id, attempts) VALUES (p_account, p_level, 1);
    END IF;
  END IF;

  UPDATE profiles SET
    coins        = coins + v_earned,
    total_deaths = total_deaths + v_deaths,
    updated_at   = now()
  WHERE account_id = p_account
  RETURNING * INTO v_profile;

  UPDATE accounts SET last_seen_at = now() WHERE id = p_account;

  -- ── achievement evaluation (skipped entirely for guest accounts) ──
  IF NOT v_guest THEN
    IF v_deaths > 0 THEN v_fresh := fn_unlock(p_account, 'first-death', v_fresh); END IF;
    IF v_profile.total_deaths >= 25  THEN v_fresh := fn_unlock(p_account, 'deaths-25',  v_fresh); END IF;
    IF v_profile.total_deaths >= 100 THEN v_fresh := fn_unlock(p_account, 'deaths-100', v_fresh); END IF;
    IF v_profile.total_deaths >= 250 THEN v_fresh := fn_unlock(p_account, 'deaths-250', v_fresh); END IF;

    IF p_won THEN
      v_fresh := fn_unlock(p_account, 'first-clear', v_fresh);
      IF v_deaths = 0 THEN v_fresh := fn_unlock(p_account, 'flawless', v_fresh); END IF;
      IF v_time > 0 AND v_time <= v_level.par_seconds * 1000 THEN
        v_fresh := fn_unlock(p_account, 'speedrun', v_fresh);
      END IF;

      SELECT count(*) INTO v_cleared FROM level_progress
        WHERE account_id = p_account AND completed;
      SELECT count(*) INTO v_total_levels FROM levels;

      IF v_cleared >= 3 THEN v_fresh := fn_unlock(p_account, 'trio', v_fresh); END IF;
      IF v_cleared >= v_total_levels THEN v_fresh := fn_unlock(p_account, 'full-clear', v_fresh); END IF;
    END IF;

    IF v_profile.coins >= 500 THEN v_fresh := fn_unlock(p_account, 'hoarder', v_fresh); END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE account_id = p_account) THEN
      v_fresh := fn_unlock(p_account, 'shopper', v_fresh);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'coinsEarned',     v_earned,
    'firstClear',      v_first_clear,
    'newAchievements', to_jsonb(v_fresh),
    'profile', jsonb_build_object(
      'coins',       v_profile.coins,
      'totalDeaths', v_profile.total_deaths,
      'unlockBoost', v_profile.unlock_boost
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buy an item. Price is read from the DB, never trusted from the client.
CREATE OR REPLACE FUNCTION fn_purchase(p_account uuid, p_item text) RETURNS jsonb AS $$
DECLARE
  v_item  shop_items%ROWTYPE;
  v_coins integer;
  v_qty   integer := 0;
BEGIN
  PERFORM set_config('exotic.service', 'on', true);

  SELECT * INTO v_item FROM shop_items WHERE id = p_item;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'unknown item'); END IF;

  SELECT coins INTO v_coins FROM profiles WHERE account_id = p_account FOR UPDATE;
  SELECT coalesce(qty, 0) INTO v_qty FROM purchases
    WHERE account_id = p_account AND item_id = p_item;
  v_qty := coalesce(v_qty, 0) + CASE WHEN v_item.price = 0 THEN 1 ELSE 0 END;

  IF NOT v_item.consumable AND v_qty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already owned');
  END IF;
  IF v_coins < v_item.price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not enough coins');
  END IF;

  UPDATE profiles SET coins = coins - v_item.price, updated_at = now()
    WHERE account_id = p_account RETURNING coins INTO v_coins;

  INSERT INTO purchases (account_id, item_id, qty) VALUES (p_account, p_item, 1)
  ON CONFLICT (account_id, item_id) DO UPDATE SET
    qty = purchases.qty + 1, purchased_at = now();

  INSERT INTO activity (account_id, kind, detail)
  VALUES (p_account, 'purchase', jsonb_build_object('item', p_item, 'price', v_item.price));

  RETURN jsonb_build_object('ok', true, 'coins', v_coins);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consume one unit of a consumable item.
CREATE OR REPLACE FUNCTION fn_use_item(p_account uuid, p_item text) RETURNS jsonb AS $$
DECLARE
  v_item shop_items%ROWTYPE;
  v_qty  integer;
  v_boost integer;
BEGIN
  PERFORM set_config('exotic.service', 'on', true);

  SELECT * INTO v_item FROM shop_items WHERE id = p_item;
  IF NOT FOUND OR NOT v_item.consumable THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not usable');
  END IF;

  SELECT qty INTO v_qty FROM purchases
    WHERE account_id = p_account AND item_id = p_item FOR UPDATE;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing to use');
  END IF;

  IF v_qty <= 1 THEN
    DELETE FROM purchases WHERE account_id = p_account AND item_id = p_item;
    v_qty := 0;
  ELSE
    UPDATE purchases SET qty = qty - 1
      WHERE account_id = p_account AND item_id = p_item RETURNING qty INTO v_qty;
  END IF;

  SELECT unlock_boost INTO v_boost FROM profiles WHERE account_id = p_account;
  IF p_item = 'gear:skip' THEN
    UPDATE profiles SET unlock_boost = unlock_boost + 1, updated_at = now()
      WHERE account_id = p_account RETURNING unlock_boost INTO v_boost;
  END IF;

  RETURN jsonb_build_object('ok', true, 'qty', v_qty, 'unlockBoost', v_boost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire stale sessions (called opportunistically by the auth layer).
CREATE OR REPLACE FUNCTION fn_gc_sessions() RETURNS void AS $$
BEGIN
  PERFORM set_config('exotic.service', 'on', true);
  DELETE FROM sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────── LEADERBOARD VIEWS ───────────────────────────────
-- Guests are excluded from every public board, by design.

CREATE OR REPLACE VIEW v_leaderboard_cleared AS
SELECT a.id AS account_id,
       coalesce(a.display_name, a.username) AS name,
       count(lp.level_id) FILTER (WHERE lp.completed)::int AS value,
       p.total_deaths
FROM accounts a
JOIN profiles p ON p.account_id = a.id
LEFT JOIN level_progress lp ON lp.account_id = a.id
WHERE a.is_guest = false
GROUP BY a.id, a.display_name, a.username, p.total_deaths
HAVING count(lp.level_id) FILTER (WHERE lp.completed) > 0
ORDER BY value DESC, p.total_deaths ASC
LIMIT 50;

CREATE OR REPLACE VIEW v_leaderboard_deaths AS
SELECT a.id AS account_id,
       coalesce(a.display_name, a.username) AS name,
       p.total_deaths AS value,
       count(lp.level_id) FILTER (WHERE lp.completed)::int AS cleared
FROM accounts a
JOIN profiles p ON p.account_id = a.id
JOIN level_progress lp ON lp.account_id = a.id AND lp.completed
WHERE a.is_guest = false
GROUP BY a.id, a.display_name, a.username, p.total_deaths
ORDER BY p.total_deaths ASC
LIMIT 50;

CREATE OR REPLACE VIEW v_leaderboard_speed AS
SELECT a.id AS account_id,
       coalesce(a.display_name, a.username) AS name,
       sum(lp.best_time_ms)::int AS value,
       count(*)::int AS cleared
FROM accounts a
JOIN level_progress lp ON lp.account_id = a.id AND lp.completed
WHERE a.is_guest = false AND lp.best_time_ms IS NOT NULL
GROUP BY a.id, a.display_name, a.username
ORDER BY sum(lp.best_time_ms) ASC
LIMIT 50;

-- ──────────────────────── ROW LEVEL SECURITY ───────────────────────────────
-- FORCE is used so even the table owner is subject to policy. Player-scoped
-- rows are readable/writable only by their owner; trusted server paths opt in
-- via the `exotic.service` flag.

CREATE OR REPLACE FUNCTION fn_current_account() RETURNS uuid AS $$
  SELECT nullif(current_setting('exotic.account_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION fn_is_service() RETURNS boolean AS $$
  SELECT coalesce(current_setting('exotic.service', true), '') = 'on';
$$ LANGUAGE sql STABLE;

DO $$
DECLARE t text;
BEGIN
  -- owner-scoped tables
  FOREACH t IN ARRAY ARRAY['profiles','settings','level_progress','purchases','account_achievements','activity']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL
         USING (account_id = fn_current_account() OR fn_is_service())
         WITH CHECK (account_id = fn_current_account() OR fn_is_service())', t, t);
  END LOOP;

  -- accounts: a user may only see/modify their own row
  EXECUTE 'ALTER TABLE accounts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE accounts FORCE  ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS accounts_self ON accounts';
  EXECUTE 'CREATE POLICY accounts_self ON accounts FOR ALL
             USING (id = fn_current_account() OR fn_is_service())
             WITH CHECK (id = fn_current_account() OR fn_is_service())';

-- sessions: service-only (the auth layer is the sole consumer)
  EXECUTE 'ALTER TABLE sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sessions FORCE  ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS sessions_service ON sessions';
  EXECUTE 'CREATE POLICY sessions_service ON sessions FOR ALL
              USING (fn_is_service()) WITH CHECK (fn_is_service())';

  -- email verification tokens: service-only
  EXECUTE 'ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE email_verification_tokens FORCE  ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS email_verification_tokens_service ON email_verification_tokens';
  EXECUTE 'CREATE POLICY email_verification_tokens_service ON email_verification_tokens FOR ALL
              USING (fn_is_service()) WITH CHECK (fn_is_service())';

  -- content tables: world-readable, service-writable
  FOREACH t IN ARRAY ARRAY['levels','shop_items','achievements']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON %I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL
                      USING (fn_is_service()) WITH CHECK (fn_is_service())', t, t);
  END LOOP;
END $$;

-- ─────────────────────────── CONTENT SEED ──────────────────────────────────

INSERT INTO levels (id, name, sub, par_seconds, deathless_bonus, sort) VALUES
  (1,'TRUST ISSUES','The floor has opinions.',25,40,1),
  (2,'FALSE PROMISES','Flags may be less real than they appear.',35,50,2),
  (3,'AIR IS A LIE','Invisible things ruin everything.',40,60,3),
  (4,'GRAVITY FLIPS','Up is a suggestion.',50,70,4),
  (5,'THE COLLECTOR','Coins are bait. You are the fish.',55,80,5),
  (6,'EXOTIC','The final betrayal.',70,120,6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, sub = EXCLUDED.sub,
  par_seconds = EXCLUDED.par_seconds, deathless_bonus = EXCLUDED.deathless_bonus;

INSERT INTO shop_items (id, category, name, blurb, price, consumable, sort) VALUES
  ('skin:solid','skin','SLAB','The default. Dense, honest, doomed.',0,false,1),
  ('skin:hollow','skin','HOLLOW','An empty box. Like your confidence.',160,false,2),
  ('skin:diagonal','skin','WEDGE','Split personality, 45 degrees.',200,false,3),
  ('skin:checker','skin','CHECKER','Four pixels of pure stability.',240,false,4),
  ('skin:ghost','skin','PHANTOM','Half-here. Fully breakable.',320,false,5),
  ('trail:none','trail','BARE','No trail. Leave no trace.',0,false,6),
  ('trail:pixels','trail','PIXELRAIN','Shed tiny squares while sprinting.',180,false,7),
  ('trail:comet','trail','COMET','A shrinking tail of speed.',220,false,8),
  ('trail:shadow','trail','AFTERIMAGE','Your past selves, lagging behind.',300,false,9),
  ('gear:reveal','gear','TRAP-SCOPE','Every trap is invisible until it springs. This flashes them all for 2 seconds.',70,true,10),
  ('gear:pass','gear','ANCHOR','Drop one extra checkpoint, anywhere, mid-run.',130,true,11),
  ('gear:skip','gear','SKIP TOKEN','Permanently unlock the level after your current one.',400,true,12),
  ('taunt:classic','taunt','CLASSIC RAGE','The original verbal slap.',0,false,13),
  ('taunt:corporate','taunt','CORPORATE','Deaths, now with HR-approved feedback.',140,false,14),
  ('taunt:poetic','taunt','POETIC','Every fall, a tiny tragedy.',200,false,15),
  ('taunt:minimal','taunt','MINIMAL','No words. Just judgment.',120,false,16)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category, name = EXCLUDED.name, blurb = EXCLUDED.blurb,
  price = EXCLUDED.price, consumable = EXCLUDED.consumable, sort = EXCLUDED.sort;

INSERT INTO achievements (key, name, description, sort) VALUES
  ('first-death','WELCOME TO EXOTIC','Die for the first time. The game thanks you.',1),
  ('first-clear','ACTUALLY NOT BAD','Complete your first level.',2),
  ('deaths-25','COMMITTED','Reach 25 total deaths.',3),
  ('deaths-100','CENTURY OF PAIN','Reach 100 total deaths.',4),
  ('deaths-250','PROFESSIONAL VICTIM','Reach 250 total deaths.',5),
  ('flawless','UNTOUCHABLE','Complete a level without dying.',6),
  ('speedrun','AGAINST THE CLOCK','Beat a level under par time.',7),
  ('trio',E'THIRD TIME\'S THE CHARM','Complete 3 different levels.',8),
  ('full-clear','EXOTIC CERTIFIED','Complete every level.',9),
  ('hoarder','SQUARE RICH','Hold 500 coins at once.',10),
  ('shopper','ENABLING THE ECONOMY','Buy something from the shop.',11)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, sort = EXCLUDED.sort;

-- ───────────────── APPLICATION ROLE (makes RLS actually bite) ──────────────
-- The pool connects as a superuser, and superusers bypass RLS entirely.
-- Every request therefore runs `SET LOCAL ROLE exotic_app` inside its
-- transaction so the policies above are genuinely enforced.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exotic_app') THEN
    CREATE ROLE exotic_app NOLOGIN;
  END IF;
END $$;

-- On Supabase the connection user is `postgres`, which is not a superuser.
-- It needs membership in exotic_app before `SET LOCAL ROLE` can succeed.
GRANT exotic_app TO postgres;

GRANT USAGE ON SCHEMA public TO exotic_app;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO exotic_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO exotic_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO exotic_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO exotic_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO exotic_app;

-- Public, read-only content for the Supabase anon client.
GRANT SELECT ON levels, shop_items, achievements TO anon;

-- Ask PostgREST to pick up fresh tables/views immediately after a migration.
NOTIFY pgrst, 'reload schema';
