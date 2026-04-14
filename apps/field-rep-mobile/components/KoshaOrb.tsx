import { useRef, useCallback } from 'react'
import { View, Animated, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors } from '../lib/theme'

type Props = {
  size?: number
  onPress?: () => void
  glow?: boolean
  showIcon?: boolean
}

export function KoshaOrb({ size = 180, onPress, glow = true, showIcon = true }: Props) {
  const iconSize = size * 0.4
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = useCallback(() => {
    if (!onPress) return
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 5,
      tension: 200,
    }).start()
  }, [scaleAnim, onPress])

  const handlePressOut = useCallback(() => {
    if (!onPress) return
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 150,
    }).start()
  }, [scaleAnim, onPress])

  const orb = (
    <Animated.View style={[
      glow ? styles.outer : null,
      glow ? {
        width: size + 16,
        height: size + 16,
        borderRadius: (size + 16) / 2,
        transform: [{ scale: scaleAnim }],
      } : {
        transform: [{ scale: scaleAnim }],
      },
    ]}>
      <View style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        glow ? styles.orbGlow : null,
      ]}>
        {showIcon && <Ionicons name="mic" size={iconSize} color={colors.text} />}
      </View>
    </Animated.View>
  )

  if (onPress) {
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onPress?.()
        }}
      >
        {orb}
      </Pressable>
    )
  }

  return orb
}

const styles = StyleSheet.create({
  outer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 121, 66, 0.15)',
  },
  orb: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  orbGlow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
})
