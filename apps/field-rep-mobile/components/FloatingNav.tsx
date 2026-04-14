import { useRef, useEffect } from 'react'
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'

type Props = {
  activeTab: 'home' | 'accounts'
  onTabPress: (tab: 'home' | 'accounts') => void
}

const TAB_W = 56
const TAB_H = 44
const PADDING = 5
const PILL_H = TAB_H + PADDING * 2
const PILL_R = PILL_H / 2
const IND_R = TAB_H / 2

export function FloatingNav({ activeTab, onTabPress }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'accounts' ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start()
  }, [activeTab, slideAnim])

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TAB_W],
  })

  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {/* Sliding indicator */}
        <Animated.View
          style={[
            styles.indicator,
            { transform: [{ translateX }] },
          ]}
        />

        {/* Home */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress('home')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={20}
            color={activeTab === 'home' ? colors.text : colors.textPlaceholder}
          />
        </TouchableOpacity>

        {/* Accounts */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress('accounts')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'accounts' ? 'people' : 'people-outline'}
            size={20}
            color={activeTab === 'accounts' ? colors.text : colors.textPlaceholder}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: PILL_R,
    padding: PADDING,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    width: TAB_W,
    height: TAB_H,
    borderRadius: IND_R,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    width: TAB_W,
    height: TAB_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
