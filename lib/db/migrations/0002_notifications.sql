CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  user_id integer REFERENCES users(id),
  is_read integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
