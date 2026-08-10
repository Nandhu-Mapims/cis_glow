import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/colors';
import { resolveMediaUrl } from '../utils/media';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {user?.photoUrl ? (
          <Image source={{ uri: resolveMediaUrl(user.photoUrl) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {(user?.memberName || user?.memberId || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user?.memberName}</Text>
        <Text style={styles.meta}>{user?.memberId}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.accessType}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
        onPress={logout}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 14, backgroundColor: colors.border },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: colors.primary },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonPressed: { opacity: 0.7 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
