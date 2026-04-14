import { useCallback } from 'react'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { FloatingNav } from '../../components/FloatingNav'

export default function TabLayout() {
  const pathname = usePathname()
  const router = useRouter()

  const activeTab = pathname === '/accounts' ? 'accounts' : 'home'

  const handleTabPress = useCallback((tab: 'home' | 'accounts') => {
    if (tab === 'home') router.replace('/')
    else router.replace('/accounts')
  }, [router])

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { display: 'none' },
          animation: 'shift',
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" />
      </Tabs>

      <FloatingNav activeTab={activeTab} onTabPress={handleTabPress} />
    </>
  )
}
