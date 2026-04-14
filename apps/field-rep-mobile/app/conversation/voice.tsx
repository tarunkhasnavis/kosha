import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useAudioRecorder } from 'expo-audio-studio'
import { Audio } from 'expo-av'
import { createOrchestrator, type Orchestrator } from '../../lib/conversation/orchestrator'
import { KoshaOrb } from '../../components/KoshaOrb'
import { colors, fonts, fontSizes, radii } from '../../lib/theme'

export default function ConversationScreen() {
  const router = useRouter()
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>()
  const sessionMode = initialMode === 'text' ? 'chat' : 'voice'
  const [isTyping, setIsTyping] = useState(sessionMode === 'chat')
  const [textInput, setTextInput] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [sessionState, setSessionState] = useState<string>('IDLE')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState<{ speaker: 'rep' | 'agent'; text: string }[]>([])

  const orchestratorRef = useRef<Orchestrator | null>(null)

  const pulseAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const expandAnim = useRef(new Animated.Value(0)).current
  const scrollRef = useRef<ScrollView>(null)
  const textInputRef = useRef<TextInput>(null)

  const hasText = textInput.trim().length > 0

  // Audio recorder with streaming + VAD
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    metering,
  } = useAudioRecorder({
    sampleRate: 16000,
    channels: 1,
    encoding: 'pcm_16bit',
    interval: 250,
    enableProcessing: true,
    onAudioStream: async ({ data }) => {
      if (data && orchestratorRef.current) {
        try {
          const binaryString = atob(data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          orchestratorRef.current.sendAudioChunk(bytes.buffer)
        } catch (e) {
          console.warn('Audio stream error:', e)
        }
      }
    },
  })

  // Pulse orb with metering
  useEffect(() => {
    if (isTyping || isSpeaking) return
    const level = metering ?? -160
    const normalized = Math.max(0, (level + 60) / 60)
    const scale = 1 + normalized * 0.15
    Animated.spring(pulseAnim, {
      toValue: scale,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start()

    // Feed metering to VAD
    if (orchestratorRef.current) {
      orchestratorRef.current.processAudioLevel(level)
    }
  }, [metering, pulseAnim, isTyping, isSpeaking])

  // Glow when agent is speaking
  useEffect(() => {
    if (isSpeaking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    } else {
      glowAnim.setValue(0)
    }
  }, [isSpeaking, glowAnim])

  // Expand animation for send button
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: (isTyping && hasText) ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 120,
    }).start()
  }, [isTyping, hasText, expandAnim])

  // Start orchestrator and recording on mount
  useEffect(() => {
    activateKeepAwakeAsync()

    const startSession = async () => {
      console.log('Starting session...')

      // Create orchestrator
      const orch = createOrchestrator({
        deepgramKey: process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY!,
        anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!,
        elevenLabsKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY!,
        sessionMode,
        onStateChange: (state) => {
          setSessionState(state)
          if (state === 'COMPLETE') {
            deactivateKeepAwake()
            router.back()
          }
        },
        onTranscriptUpdate: (entries) => {
          setTranscript([...entries])
          scrollRef.current?.scrollToEnd({ animated: true })
        },
        onAgentText: () => {},
        onPlayAudio: async (audioData) => {
          setIsSpeaking(true)
          try {
            // Pause recording for clean speaker playback
            await pauseRecording()

            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
            })

            const base64 = arrayBufferToBase64(audioData)
            const { sound } = await Audio.Sound.createAsync(
              { uri: `data:audio/mpeg;base64,${base64}` },
              { shouldPlay: true, volume: 1.0 }
            )

            await new Promise<void>((resolve) => {
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync()
                  resolve()
                }
              })
            })

            // Resume recording
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
            })
            await resumeRecording()
          } catch (error) {
            console.error('Playback error:', error)
          }
          setIsSpeaking(false)
        },
        onPlayBeep: () => {
          console.log('[thinking beep]')
        },
        onSessionEnd: (transcriptJson) => {
          console.log('Session ended, transcript:', transcriptJson.length, 'chars')
        },
      })

      orchestratorRef.current = orch

      // Start Deepgram (non-blocking)
      orch.start().catch((e) => console.warn('Orchestrator start:', e))

      // Start recording with expo-audio-studio
      try {
        await startRecording()
        console.log('Recording started with expo-audio-studio')
      } catch (error) {
        console.error('Failed to start recording:', error)
      }
    }

    startSession()

    return () => {
      deactivateKeepAwake()
      stopRecording()
      orchestratorRef.current?.cleanup()
    }
  }, [sessionMode, router])

  useEffect(() => {
    if (isTyping) setTimeout(() => textInputRef.current?.focus(), 100)
  }, [isTyping])

  const handleTextBarPress = useCallback(() => setIsTyping(true), [])

  const handleMuteToggle = useCallback(async () => {
    if (isMuted) {
      await resumeRecording()
    } else {
      await pauseRecording()
    }
    setIsMuted(!isMuted)
  }, [isMuted, pauseRecording, resumeRecording])

  const handleSend = useCallback(() => {
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    orchestratorRef.current?.sendTextMessage(text)
  }, [textInput])

  const handleEnd = useCallback(async () => {
    await stopRecording()
    orchestratorRef.current?.stop()
  }, [stopRecording])

  const statusText = isMuted ? 'Muted' : (sessionState === 'ACTIVE' ? 'Listening...' : 'Wrapping up...')

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.topBarTitleRow}>
          <Text style={styles.topBarTitle}>kosha</Text>
          <Text style={styles.topBarVoice}>{sessionMode}</Text>
        </View>
      </View>

      {isTyping && transcript.length > 0 ? (
        <ScrollView
          ref={scrollRef} style={styles.chatArea} contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {transcript.map((entry, i) => (
            <View key={i} style={[styles.bubble, entry.speaker === 'rep' ? styles.repBubble : styles.agentBubble]}>
              <Text style={[styles.bubbleText, entry.speaker === 'rep' ? styles.repText : styles.agentText]}>
                {entry.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.voiceArea}>
          <Animated.View style={[styles.glowRing, {
            opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
            transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
          }]} />
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <KoshaOrb size={140} glow={false} showIcon={false} />
          </Animated.View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={styles.bottomBar}>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.actionButton, isMuted && styles.actionButtonActive]}
              onPress={handleMuteToggle}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? colors.error : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.textField} onPress={handleTextBarPress} activeOpacity={1}>
              {isTyping ? (
                <TextInput
                  ref={textInputRef} style={styles.textInput} value={textInput}
                  onChangeText={setTextInput} placeholder="type your notes..."
                  placeholderTextColor={colors.textPlaceholder} multiline maxLength={2000}
                />
              ) : (
                <Text style={styles.textFieldPlaceholder}>type your notes...</Text>
              )}
            </TouchableOpacity>

            {isTyping && hasText ? (
              <Animated.View style={{
                opacity: expandAnim,
                transform: [{ scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }}>
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                  <Ionicons name="arrow-up" size={18} color={colors.text} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View style={{
                opacity: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }],
              }}>
                <TouchableOpacity style={styles.stopButton} onPress={handleEnd}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topBarTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  topBarTitle: { fontSize: fontSizes.lg, fontFamily: fonts.displayBold, color: colors.text },
  topBarVoice: { fontSize: fontSizes.lg, fontFamily: fonts.display, color: colors.textMuted },
  voiceArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glowRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: colors.accent },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, flexGrow: 1 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.xl, marginBottom: 8 },
  repBubble: { alignSelf: 'flex-end', backgroundColor: colors.surfaceHover },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { fontSize: fontSizes.base, lineHeight: 21 },
  repText: { color: colors.text },
  agentText: { color: colors.text },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 8 },
  controlsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  textField: {
    flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 18, paddingVertical: 12, minHeight: 48, justifyContent: 'center',
  },
  textFieldPlaceholder: { fontSize: fontSizes.sm, color: colors.textPlaceholder },
  textInput: { fontSize: fontSizes.base, color: colors.text, maxHeight: 100, padding: 0 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  actionButtonActive: { backgroundColor: colors.surfaceHover },
  stopButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
})
