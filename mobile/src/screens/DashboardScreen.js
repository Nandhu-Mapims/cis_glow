import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import api from '../api/client';
import { colors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';

/**
 * v1: lists the widgets the logged-in user is entitled to (same set the web
 * dashboard shows via GET /api/dashboard) and fetches their raw payload from
 * GET /api/dashboard/widgets?w=<name>. Rendering stays generic (title + JSON
 * summary) until per-widget native cards are built out module by module.
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [shell, setShell] = useState(null);
  const [widgetData, setWidgetData] = useState({});

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/dashboard');
      setShell(res.data);

      const names = (res.data.widgets || []).map((w) => w.id);
      if (names.length) {
        const dataRes = await api.get('/dashboard/widgets', {
          params: { w: names.join(',') },
        });
        setWidgetData(dataRes.data || {});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load dashboard.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={shell?.widgets || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>Hello, {shell?.memberName || user?.memberName}</Text>
            <Text style={styles.meta}>{shell?.accessType} · {shell?.username}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const value = widgetData[item.id];
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardBody} numberOfLines={4}>
                {summarize(value)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.cardBody}>No dashboard widgets are enabled for this account.</Text>
          </View>
        }
      />
    </View>
  );
}

function summarize(value) {
  if (value == null) return 'Loading…';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  try {
    return JSON.stringify(value, null, 2).slice(0, 300);
  } catch {
    return 'Unable to display this widget yet.';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 12 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  error: { color: colors.danger, marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
  cardBody: { fontSize: 13, color: colors.textMuted, fontFamily: 'monospace' },
});
