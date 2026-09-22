"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMe, fetchSettings, type Me, type Settings } from "./api";
import { errorMessage } from "./api";

export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setMe(await fetchMe());
    } catch (err) {
      setError(errorMessage(err));
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { me, error, reload, loading: me === undefined };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSettings(await fetchSettings());
    } catch (err) {
      setError(errorMessage(err, "Could not load practice settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, error, loading, reload };
}
