import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { colors, fonts, fontSizes, radii } from '../../lib/theme'

type Account = {
  id: string
  name: string
  industry: string | null
  summary: string
  last_conversation_at: string | null
}

export default function AccountsScreen() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const fetchAccounts = useCallback(async () => {
    // TODO: Query voice.accounts once schema is created
    // For now, return empty — accounts emerge from conversations
    setAccounts([])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchAccounts()
  }, [fetchAccounts])

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accounts</Text>
      </View>

      {accounts.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textPlaceholder} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search accounts..."
            placeholderTextColor={colors.textPlaceholder}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textPlaceholder} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
      ) : accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>No accounts yet</Text>
          <Text style={styles.emptySubtext}>
            Your accounts will appear here as you have conversations. Just tap the mic and start talking.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => router.push(`/account/${item.id}`)}
              activeOpacity={0.6}
            >
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{item.name}</Text>
                {item.industry && (
                  <Text style={styles.accountIndustry}>{item.industry}</Text>
                )}
              </View>
              <View style={styles.accountMeta}>
                {item.last_conversation_at && (
                  <Text style={styles.dateText}>
                    {formatDate(item.last_conversation_at)}
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>No accounts match your search</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: fontSizes['2xl'],
    fontFamily: fonts.displayBold,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.displayBold,
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: fontSizes.base,
    color: colors.textPlaceholder,
    textAlign: 'center',
    lineHeight: 22,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  accountInfo: {
    flex: 1,
    marginRight: 12,
  },
  accountName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.displayBold,
    color: colors.text,
    marginBottom: 2,
  },
  accountIndustry: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  accountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: fontSizes.sm,
    color: colors.textPlaceholder,
  },
  emptyList: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyListText: {
    fontSize: fontSizes.base,
    color: colors.textPlaceholder,
  },
})
