import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes } from '../../lib/theme'
import { useAppStore } from '../../stores/app'
import { KoshaOrb } from '../../components/KoshaOrb'
import { BackgroundGrid } from '../../components/BackgroundGrid'

export default function HomeScreen() {
  const router = useRouter()
  const session = useAppStore((s) => s.session)
  const avatarUrl = session?.user?.user_metadata?.avatar_url

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackgroundGrid />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="folder-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/settings')}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={16} color={colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Center — orb + actions */}
      <View style={styles.center}>
        <KoshaOrb size={190} onPress={() => router.push('/conversation/voice')} />
        <Text style={styles.micLabel}>tap to talk</Text>

        <TouchableOpacity
          style={styles.textInputBar}
          onPress={() => router.push('/conversation/voice?mode=text')}
          activeOpacity={0.7}
        >
          <Text style={styles.textInputPlaceholder}>or type your thoughts...</Text>
          <View style={styles.sendIcon}>
            <Ionicons name="arrow-up" size={16} color={colors.text} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Spacer for floating nav */}
      <View style={styles.navSpacer} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
  },
  micLabel: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    marginTop: 4,
  },
  textInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    width: '80%',
    marginTop: 24,
  },
  textInputPlaceholder: {
    fontSize: fontSizes.sm,
    color: colors.textPlaceholder,
  },
  sendIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navSpacer: {
    height: 100,
  },
})
