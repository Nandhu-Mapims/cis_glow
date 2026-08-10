import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import api from '../api/client';
import { colors } from '../theme/colors';

/**
 * Renders the same category → main-menu → sub-menu tree the web sidebar
 * builds from GET /api/menu (server/src/routes/menu.js), already scoped to
 * the logged-in user's accessType/authentication_tb rows.
 */
export default function MenuScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/menu');
      const categories = res.data.menu || res.data.categories || res.data || [];
      const built = categories
        .map((category) => ({
          title: category.name,
          data: (category.mainMenus || []).flatMap((main) => main.subMenus || []),
        }))
        .filter((section) => section.data.length > 0);
      setSections(built);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load menu.');
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
    <SectionList
      style={styles.flex}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate('Module', { link: item.link, title: item.name })}
        >
          <Text style={styles.rowText}>{item.name}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 32 },
  error: { color: colors.danger, marginBottom: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowPressed: { opacity: 0.7 },
  rowText: { fontSize: 14, color: colors.text, flex: 1 },
  rowChevron: { fontSize: 18, color: colors.textMuted },
});
