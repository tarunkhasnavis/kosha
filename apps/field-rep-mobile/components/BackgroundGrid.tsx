import { View, StyleSheet } from 'react-native'

export function BackgroundGrid() {
  return (
    <View style={styles.grid} pointerEvents="none">
      {Array.from({ length: 20 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.lineH, { top: i * 40 }]} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.lineV, { left: i * 40 }]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  lineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  lineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
})
