import { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, fontSizes } from '../lib/theme'
import { BackgroundGrid } from '../components/BackgroundGrid'

WebBrowser.maybeCompleteAuthSession()

type OAuthProvider = 'google' | 'azure'

export default function LoginScreen() {
  const handleOAuthLogin = useCallback(async (provider: OAuthProvider) => {
    const redirectTo = Linking.createURL('auth/callback')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      console.error('OAuth error:', error.message)
      Alert.alert('Login failed', error.message)
      return
    }

    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1]
        if (fragment) {
          const params = new URLSearchParams(fragment)
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) {
              console.error('Session error:', sessionError.message)
              Alert.alert('Login failed', sessionError.message)
            }
          }
        }
      }
    }
  }, [])

  return (
    <View style={styles.container}>
      <BackgroundGrid />
      <View style={styles.header}>
        <Text style={styles.title}>kosha</Text>
        <Text style={styles.subtitle}>your AI field assistant</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleOAuthLogin('google')}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-google" size={20} color={colors.text} />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => handleOAuthLogin('azure')}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-microsoft" size={20} color={colors.text} />
          <Text style={styles.buttonText}>Continue with Microsoft</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 64,
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginBottom: 8,
  },
  title: {
    fontSize: fontSizes['4xl'],
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: fontSizes.lg,
    color: colors.textMuted,
  },
  buttons: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
})
