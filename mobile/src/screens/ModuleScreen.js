import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Fallback for any menu link that doesn't have a native screen yet.
 * Deliberately does NOT embed the legacy PHP page or the web SPA in a
 * WebView — this app is meant to stay a native REST client (see mobile.md),
 * so unbuilt screens show as a clear "coming soon" rather than a disguised
 * webview. Add a real native screen + route (see MainNavigator.js) as each
 * module is ported, module by module, per mobile.md Phase 1+.
 */
export default function ModuleScreen({ route }) {
  const { link, title } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title || 'Module'}</Text>
      <Text style={styles.body}>
        This screen isn&apos;t built natively in the mobile app yet. It&apos;s available today
        on the CIS web app.
      </Text>
      {link ? <Text style={styles.link}>{link}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 12, color: colors.textMuted, marginTop: 14, fontFamily: 'monospace' },
});
