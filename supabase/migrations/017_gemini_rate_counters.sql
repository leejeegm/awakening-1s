-- Gemini API 호출 윈도우 카운터 (서버리스·다중 인스턴스에서 공유)
CREATE TABLE IF NOT EXISTS public.gemini_rate_counters (
  rate_key text NOT NULL,
  window_start timestamptz NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (rate_key, window_start)
);

ALTER TABLE public.gemini_rate_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_consume_gemini_rate(
  p_rate_key text,
  p_window_start timestamptz,
  p_max integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF char_length(p_rate_key) > 200 OR char_length(p_rate_key) < 1 THEN
    RAISE EXCEPTION 'invalid p_rate_key';
  END IF;
  IF p_max < 1 OR p_max > 100000 THEN
    RAISE EXCEPTION 'invalid p_max';
  END IF;

  INSERT INTO public.gemini_rate_counters (rate_key, window_start, call_count)
  VALUES (p_rate_key, p_window_start, 1)
  ON CONFLICT (rate_key, window_start)
  DO UPDATE SET call_count = public.gemini_rate_counters.call_count + 1
  RETURNING call_count INTO new_count;

  RETURN new_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_gemini_rate(text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_consume_gemini_rate(text, timestamptz, integer) TO service_role;
